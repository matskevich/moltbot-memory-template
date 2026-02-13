#!/usr/bin/env node

// cli.ts
import * as os2 from "node:os";
import * as path3 from "node:path";
import * as fs2 from "node:fs/promises";

// auditor.ts
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

// utils/hash.ts
import * as crypto from "node:crypto";
function hashString(content) {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

// utils/ioc-db.ts
var INLINE_IOC_DB = {
  version: "2026.02.07",
  last_updated: "2026-02-07T00:00:00Z",
  c2_ips: ["91.92.242.30"],
  malicious_domains: ["webhook.site"],
  malicious_skill_hashes: {
    e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855: "clawhavoc-empty-payload",
    a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2: "clawhavoc-exfiltrator"
  },
  typosquat_patterns: [
    "clawhub",
    "clawhub1",
    "clawhubb",
    "cllawhub",
    "clawdhub",
    "moltbot",
    "clawdbot"
  ],
  dangerous_prerequisite_patterns: [
    "curl.*\\|.*bash",
    "password.*protected.*zip",
    "download.*prerequisite"
  ],
  infostealer_artifacts: {
    macos: ["/tmp/.*amos", "~/Library/Application Support/.*stealer"],
    linux: ["/tmp/.*redline", "/tmp/.*lumma"]
  }
}, cachedDb = null;
async function loadIOCDatabase(_customPath) {
  return cachedDb || (cachedDb = INLINE_IOC_DB, cachedDb);
}
function isKnownC2(db, ip) {
  return db.c2_ips.includes(ip);
}
function isKnownMaliciousDomain(db, domain) {
  return db.malicious_domains.some((d) => domain === d || domain.endsWith("." + d));
}
function isKnownMaliciousHash(db, sha256) {
  return db.malicious_skill_hashes[sha256] ?? null;
}
function matchesTyposquat(db, name) {
  let normalized = name.toLowerCase().replace(/[-_\s]/g, "");
  return db.typosquat_patterns.some((pattern) => {
    let normalizedPattern = pattern.toLowerCase().replace(/[-_\s]/g, "");
    return normalized === normalizedPattern || normalized.includes(normalizedPattern);
  });
}
function matchesDangerousPattern(db, content) {
  let matches = [];
  for (let pattern of db.dangerous_prerequisite_patterns)
    new RegExp(pattern, "i").test(content) && matches.push(pattern);
  return matches;
}
function getInfostealerArtifacts(db, platform2) {
  return platform2 === "darwin" ? db.infostealer_artifacts.macos : platform2 === "linux" ? db.infostealer_artifacts.linux : [];
}

// auditor.ts
var API_KEY_PATTERNS = [
  /sk-ant-[a-zA-Z0-9_-]{20,}/,
  /sk-proj-[a-zA-Z0-9_-]{20,}/,
  /sk-[a-zA-Z0-9_-]{20,}/,
  /xoxb-[a-zA-Z0-9_-]{20,}/,
  /xoxp-[a-zA-Z0-9_-]{20,}/
], PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /you\s+are\s+now/i,
  /new\s+system\s+prompt/i,
  /forward\s+to/i,
  /send\s+to/i,
  /exfiltrate/i
], BASE64_BLOCK_PATTERN = /[A-Za-z0-9+/=]{50,}/, DANGEROUS_SKILL_PATTERNS = [
  { pattern: /child_process/, description: "child_process import" },
  { pattern: /\.exec\s*\(/, description: "exec() call" },
  { pattern: /\.spawn\s*\(/, description: "spawn() call" },
  { pattern: /eval\s*\(/, description: "eval() call" },
  { pattern: /Function\s*\(/, description: "Function() constructor" },
  { pattern: /webhook\.site/, description: "webhook.site exfiltration endpoint" },
  { pattern: /reverse.shell/, description: "reverse shell pattern" },
  { pattern: /base64.*decode/i, description: "base64 decode (obfuscation)" },
  { pattern: /curl\s+.*\|\s*sh/, description: "curl pipe to shell" },
  { pattern: /wget\s+.*\|\s*sh/, description: "wget pipe to shell" },
  { pattern: /~\/\.openclaw/, description: "access to openclaw config" },
  { pattern: /~\/\.clawdbot/, description: "access to legacy clawdbot config" },
  { pattern: /creds\.json/, description: "credential file access" },
  { pattern: /\.env/, description: ".env file access" },
  { pattern: /auth-profiles/, description: "auth-profiles access" },
  { pattern: /LD_PRELOAD/, description: "LD_PRELOAD injection" },
  { pattern: /DYLD_INSERT/, description: "DYLD_INSERT library injection" },
  { pattern: /NODE_OPTIONS/, description: "NODE_OPTIONS injection" }
], SEVERITY_DEDUCTIONS = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 3,
  LOW: 1,
  INFO: 0
};
function calculateScore(findings) {
  let score = 100;
  for (let finding of findings)
    score -= SEVERITY_DEDUCTIONS[finding.severity];
  return Math.max(0, score);
}
function computeSummary(findings) {
  let summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    autoFixable: 0
  };
  for (let f of findings) {
    switch (f.severity) {
      case "CRITICAL":
        summary.critical++;
        break;
      case "HIGH":
        summary.high++;
        break;
      case "MEDIUM":
        summary.medium++;
        break;
      case "LOW":
        summary.low++;
        break;
      case "INFO":
        summary.info++;
        break;
    }
    f.autoFixable && summary.autoFixable++;
  }
  return summary;
}
function probePort(port, host, timeoutMs = 2e3) {
  return new Promise((resolve) => {
    let socket = new net.Socket(), settled = !1, finish = (result) => {
      settled || (settled = !0, socket.destroy(), resolve(result));
    };
    socket.setTimeout(timeoutMs), socket.once("connect", () => finish(!0)), socket.once("timeout", () => finish(!1)), socket.once("error", () => finish(!1)), socket.connect(port, host);
  });
}
async function auditGateway(ctx, deep = !1) {
  let findings = [], gw = ctx.config.gateway;
  gw?.bind !== "loopback" && findings.push({
    id: "SC-GW-001",
    severity: "CRITICAL",
    category: "gateway",
    title: "Gateway not bound to loopback",
    description: `Gateway is bound to "${gw?.bind ?? "all interfaces"}" instead of loopback. This exposes the gateway to network attacks.`,
    evidence: `gateway.bind = "${gw?.bind ?? "undefined"}"`,
    remediation: 'Set gateway.bind to "loopback" in openclaw.json',
    autoFixable: !0,
    references: ["CVE-2026-25253"],
    owaspAsi: "ASI03"
  });
  let authMode = gw?.auth?.mode;
  authMode !== "password" && authMode !== "token" && findings.push({
    id: "SC-GW-002",
    severity: "CRITICAL",
    category: "gateway",
    title: "Gateway authentication disabled",
    description: `Gateway authentication mode is "${authMode ?? "none"}". Anyone with network access can control this instance.`,
    evidence: `gateway.auth.mode = "${authMode ?? "undefined"}"`,
    remediation: 'Set gateway.auth.mode to "password" or "token" and configure a strong credential',
    autoFixable: !0,
    references: ["CVE-2026-25253"],
    owaspAsi: "ASI03"
  });
  let token = gw?.auth?.token ?? gw?.auth?.password ?? "";
  (authMode === "token" || authMode === "password") && token.length > 0 && token.length < 32 && findings.push({
    id: "SC-GW-003",
    severity: "MEDIUM",
    category: "gateway",
    title: "Weak gateway authentication token",
    description: `Gateway auth token/password is only ${token.length} characters. Minimum 32 recommended.`,
    evidence: `Token length: ${token.length} characters`,
    remediation: "Generate a token of at least 32 characters using a CSPRNG",
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI03"
  });
  let gatewayPort = gw?.port ?? 18789;
  if (deep)
    if (await probePort(gatewayPort, "127.0.0.1")) {
      let bindMode = gw?.bind ?? "all", isLoopback = bindMode === "loopback" || bindMode === "127.0.0.1" || bindMode === "localhost";
      findings.push({
        id: "SC-GW-004",
        severity: isLoopback ? "LOW" : "HIGH",
        category: "gateway",
        title: isLoopback ? "Gateway port open on loopback only" : "Gateway port open and bound to non-loopback interface",
        description: isLoopback ? `Port ${gatewayPort} is listening on loopback (localhost). This is the recommended configuration.` : `Port ${gatewayPort} is listening and bound to "${bindMode}". It may be accessible from other machines on the network.`,
        evidence: `Port: ${gatewayPort}, Bind: ${bindMode}, Status: open`,
        remediation: isLoopback ? "No action needed \u2014 loopback binding is secure" : 'Set gateway.bind to "loopback" to restrict access to localhost only',
        autoFixable: !isLoopback,
        references: [],
        owaspAsi: "ASI05"
      });
    } else
      findings.push({
        id: "SC-GW-004",
        severity: "INFO",
        category: "gateway",
        title: "Gateway port not listening",
        description: `Port ${gatewayPort} is not currently accepting connections. Gateway may not be running.`,
        evidence: `Port: ${gatewayPort}, Status: closed/unreachable`,
        remediation: "Start the gateway if it should be running",
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI05"
      });
  else
    findings.push({
      id: "SC-GW-004",
      severity: "INFO",
      category: "gateway",
      title: "Gateway port accessibility check",
      description: `Port ${gatewayPort} remote accessibility requires deep scan mode (--deep) for active probing.`,
      evidence: `Port: ${gatewayPort}`,
      remediation: "Run audit with --deep flag for active network probing",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI05"
    });
  let browserRelayPort = (gw?.port ?? 18789) - 897;
  if (deep)
    if (await probePort(browserRelayPort, "127.0.0.1")) {
      let bindMode = gw?.bind ?? "all", isLoopback = bindMode === "loopback" || bindMode === "127.0.0.1" || bindMode === "localhost";
      findings.push({
        id: "SC-GW-005",
        severity: isLoopback ? "LOW" : "MEDIUM",
        category: "gateway",
        title: isLoopback ? "Browser relay port open on loopback only" : "Browser relay port open and may be network-accessible",
        description: isLoopback ? `Browser relay port ${browserRelayPort} is listening on loopback. This is safe.` : `Browser relay port ${browserRelayPort} is listening and bound to "${bindMode}". The browser automation surface may be reachable from the network.`,
        evidence: `Port: ${browserRelayPort}, Bind: ${bindMode}, Status: open`,
        remediation: isLoopback ? "No action needed" : 'Set gateway.bind to "loopback" to restrict the browser relay to localhost',
        autoFixable: !isLoopback,
        references: [],
        owaspAsi: "ASI05"
      });
    } else
      findings.push({
        id: "SC-GW-005",
        severity: "INFO",
        category: "gateway",
        title: "Browser relay port not listening",
        description: `Browser relay port ${browserRelayPort} is not currently accepting connections.`,
        evidence: `Port: ${browserRelayPort}, Status: closed/unreachable`,
        remediation: "No action needed if browser automation is not in use",
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI05"
      });
  else
    findings.push({
      id: "SC-GW-005",
      severity: "INFO",
      category: "gateway",
      title: "Browser relay port check",
      description: `Browser relay port ${browserRelayPort} accessibility requires deep scan mode.`,
      evidence: `Port: ${browserRelayPort}`,
      remediation: "Run audit with --deep flag for active network probing",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI05"
    });
  return gw?.tls?.enabled || findings.push({
    id: "SC-GW-006",
    severity: "MEDIUM",
    category: "gateway",
    title: "TLS not enabled on gateway",
    description: "Gateway traffic is unencrypted. Credentials and conversation data are transmitted in plaintext.",
    evidence: "gateway.tls is not configured",
    remediation: "Configure gateway.tls with a valid certificate and key",
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI03"
  }), gw?.mdns && gw.mdns.mode !== "minimal" && findings.push({
    id: "SC-GW-007",
    severity: "MEDIUM",
    category: "gateway",
    title: "mDNS broadcasting in full mode",
    description: "mDNS is broadcasting sensitive instance information on the local network.",
    evidence: `gateway.mdns.mode = "${gw.mdns.mode}"`,
    remediation: 'Manually set gateway.mdns.mode to "minimal" (not auto-fixable \u2014 key not in OpenClaw config schema)',
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI05"
  }), gw?.bind !== "loopback" && (!gw?.trustedProxies || gw.trustedProxies.length === 0) && findings.push({
    id: "SC-GW-008",
    severity: "CRITICAL",
    category: "gateway",
    title: "Reverse proxy without trustedProxies configuration",
    description: "Gateway is network-accessible without trustedProxies set. All connections appear as localhost, bypassing authentication.",
    evidence: `gateway.bind = "${gw?.bind ?? "all"}", trustedProxies = []`,
    remediation: 'Set gateway.trustedProxies to the IP of your reverse proxy, e.g., ["127.0.0.1"]',
    autoFixable: !0,
    references: ["CVE-2026-25253"],
    owaspAsi: "ASI03"
  }), gw?.controlUi?.dangerouslyDisableDeviceAuth === !0 && findings.push({
    id: "SC-GW-009",
    severity: "CRITICAL",
    category: "gateway",
    title: "Device authentication disabled on Control UI",
    description: "dangerouslyDisableDeviceAuth is enabled, bypassing all device-level authentication for the Control UI.",
    evidence: "gateway.controlUi.dangerouslyDisableDeviceAuth = true",
    remediation: "Set gateway.controlUi.dangerouslyDisableDeviceAuth to false",
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI03"
  }), gw?.controlUi?.allowInsecureAuth === !0 && findings.push({
    id: "SC-GW-010",
    severity: "MEDIUM",
    category: "gateway",
    title: "Insecure authentication allowed on Control UI",
    description: "allowInsecureAuth is enabled, allowing weaker authentication methods.",
    evidence: "gateway.controlUi.allowInsecureAuth = true",
    remediation: "Set gateway.controlUi.allowInsecureAuth to false",
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI03"
  }), findings;
}
async function auditCredentials(ctx) {
  let findings = [], stateDirPerms = await ctx.getFilePermissions(ctx.stateDir);
  stateDirPerms !== null && (stateDirPerms & 63) !== 0 && findings.push({
    id: "SC-CRED-001",
    severity: "HIGH",
    category: "credentials",
    title: "State directory has excessive permissions",
    description: `~/.openclaw/ directory is accessible by group/other users (${stateDirPerms.toString(8)}).`,
    evidence: `Permissions: ${stateDirPerms.toString(8)} (expected: 700)`,
    remediation: "Run: chmod 700 ~/.openclaw/",
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI03"
  });
  let configPath = path.join(ctx.stateDir, "openclaw.json"), configPerms = await ctx.getFilePermissions(configPath);
  configPerms !== null && (configPerms & 63) !== 0 && findings.push({
    id: "SC-CRED-002",
    severity: "HIGH",
    category: "credentials",
    title: "Config file has excessive permissions",
    description: `openclaw.json is readable by group/other users (${configPerms.toString(8)}).`,
    evidence: `Permissions: ${configPerms.toString(8)} (expected: 600)`,
    remediation: "Run: chmod 600 ~/.openclaw/openclaw.json",
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI03"
  });
  let envPath = path.join(ctx.stateDir, ".env"), envContent = await ctx.readFile(envPath);
  envContent !== null && API_KEY_PATTERNS.some((p) => p.test(envContent)) && findings.push({
    id: "SC-CRED-003",
    severity: "HIGH",
    category: "credentials",
    title: "Plaintext API keys in .env file",
    description: "API keys are stored in plaintext in .env file. These are targeted by infostealers.",
    evidence: ".env file contains API key patterns",
    remediation: "Encrypt .env using secureclaw credential-hardening or use a secrets manager",
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI03"
  });
  let credsDir = path.join(ctx.stateDir, "credentials"), credFiles = [];
  try {
    credFiles = await ctx.listDir(credsDir);
  } catch {
  }
  for (let file of credFiles) {
    if (!file.endsWith(".json")) continue;
    let filePath = path.join(credsDir, file), perms = await ctx.getFilePermissions(filePath);
    perms !== null && (perms & 63) !== 0 && findings.push({
      id: "SC-CRED-004",
      severity: "HIGH",
      category: "credentials",
      title: `Credential file "${file}" has excessive permissions`,
      description: `Credential file is readable by group/other users (${perms.toString(8)}).`,
      evidence: `${filePath}: permissions ${perms.toString(8)}`,
      remediation: `Run: chmod 600 ${filePath}`,
      autoFixable: !0,
      references: [],
      owaspAsi: "ASI03"
    });
  }
  let agentsDir = path.join(ctx.stateDir, "agents"), agents = [];
  try {
    agents = await ctx.listDir(agentsDir);
  } catch {
  }
  for (let agent of agents) {
    let authProfilePath = path.join(agentsDir, agent, "agent", "auth-profiles.json");
    if (!await ctx.fileExists(authProfilePath)) continue;
    let perms = await ctx.getFilePermissions(authProfilePath);
    perms !== null && (perms & 63) !== 0 && findings.push({
      id: "SC-CRED-005",
      severity: "HIGH",
      category: "credentials",
      title: `Auth profiles for agent "${agent}" have excessive permissions`,
      description: `auth-profiles.json is readable by group/other users (${perms.toString(8)}).`,
      evidence: `${authProfilePath}: permissions ${perms.toString(8)}`,
      remediation: `Run: chmod 600 ${authProfilePath}`,
      autoFixable: !0,
      references: [],
      owaspAsi: "ASI03"
    });
  }
  for (let file of credFiles) {
    if (!file.endsWith(".json")) continue;
    let filePath = path.join(credsDir, file), content = await ctx.readFile(filePath);
    content && (content.includes('"access_token"') || content.includes('"refresh_token"')) && findings.push({
      id: "SC-CRED-006",
      severity: "MEDIUM",
      category: "credentials",
      title: `OAuth tokens in plaintext in "${file}"`,
      description: "OAuth access/refresh tokens are stored in plaintext, vulnerable to infostealer theft.",
      evidence: `${filePath} contains OAuth token fields`,
      remediation: "Encrypt credential files using secureclaw credential-hardening",
      autoFixable: !0,
      references: [],
      owaspAsi: "ASI03"
    });
  }
  let memoryFiles = ["soul.md", "MEMORY.md", "SOUL.md"];
  for (let agent of agents)
    for (let memFile of memoryFiles) {
      let memPath = path.join(agentsDir, agent, memFile), content = await ctx.readFile(memPath);
      content && API_KEY_PATTERNS.some((p) => p.test(content)) && findings.push({
        id: "SC-CRED-007",
        severity: "CRITICAL",
        category: "credentials",
        title: `API keys found in memory file "${memFile}"`,
        description: "API keys are present in LLM memory files. These leak credentials into the model context.",
        evidence: `${memPath} contains API key patterns`,
        remediation: "Remove API keys from memory files and redact using secureclaw credential-hardening",
        autoFixable: !0,
        references: [],
        owaspAsi: "ASI03"
      });
    }
  let allFiles = await scanForApiKeys(ctx);
  for (let match of allFiles)
    match.includes("soul.md") || match.includes("MEMORY.md") || match.includes("SOUL.md") || match.includes(".env") || findings.push({
      id: "SC-CRED-008",
      severity: "HIGH",
      category: "credentials",
      title: "API key found in configuration file",
      description: `API key pattern detected in ${path.basename(match)}.`,
      evidence: `File: ${match}`,
      remediation: "Remove or redact API keys from this file",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI03"
    });
  return findings;
}
async function scanForApiKeys(ctx) {
  let matches = [];
  async function scanDir(dir) {
    let entries;
    try {
      entries = await ctx.listDir(dir);
    } catch {
      return;
    }
    for (let entry of entries) {
      let fullPath = path.join(dir, entry);
      if (entry.endsWith(".md") || entry.endsWith(".json")) {
        let content = await ctx.readFile(fullPath);
        content && API_KEY_PATTERNS.some((p) => p.test(content)) && matches.push(fullPath);
      }
      if (!entry.startsWith(".secureclaw") && entry !== "node_modules" && await ctx.fileExists(fullPath))
        try {
          (await ctx.listDir(fullPath)).length >= 0 && await scanDir(fullPath);
        } catch {
        }
    }
  }
  return await scanDir(ctx.stateDir), matches;
}
async function auditExecution(ctx) {
  let findings = [];
  ctx.config.exec?.approvals === "off" && findings.push({
    id: "SC-EXEC-001",
    severity: "CRITICAL",
    category: "execution",
    title: "Execution approvals disabled",
    description: 'exec.approvals is set to "off". The agent can execute arbitrary commands without user confirmation.',
    evidence: 'exec.approvals = "off"',
    remediation: 'Manually set exec.approvals to "always" in your OpenClaw settings (not auto-fixable \u2014 key not in OpenClaw config schema)',
    autoFixable: !1,
    references: ["CVE-2026-25253"],
    owaspAsi: "ASI02"
  }), ctx.config.tools?.exec?.host === "gateway" && findings.push({
    id: "SC-EXEC-002",
    severity: "HIGH",
    category: "execution",
    title: "Commands execute on host, not in sandbox",
    description: 'tools.exec.host is "gateway", meaning commands run directly on the host machine without isolation.',
    evidence: 'tools.exec.host = "gateway"',
    remediation: 'Set tools.exec.host to "sandbox"',
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI05"
  }), ctx.config.sandbox?.mode !== "all" && findings.push({
    id: "SC-EXEC-003",
    severity: "MEDIUM",
    category: "execution",
    title: 'Sandbox mode not set to "all"',
    description: `Sandbox mode is "${ctx.config.sandbox?.mode ?? "undefined"}". Not all commands run in a sandboxed environment.`,
    evidence: `sandbox.mode = "${ctx.config.sandbox?.mode ?? "undefined"}"`,
    remediation: 'Manually set sandbox.mode to "all" in your OpenClaw settings (not auto-fixable \u2014 key not in OpenClaw config schema)',
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI05"
  });
  let dc = ctx.dockerCompose;
  if (dc?.services)
    for (let [svcName, svc] of Object.entries(dc.services))
      svc.read_only || findings.push({
        id: "SC-EXEC-004",
        severity: "MEDIUM",
        category: "execution",
        title: `Docker service "${svcName}" not read-only`,
        description: "Container filesystem is writable, allowing post-exploitation persistence.",
        evidence: `Service "${svcName}": read_only is not set`,
        remediation: "Add read_only: true to the service configuration",
        autoFixable: !0,
        references: [],
        owaspAsi: "ASI05"
      }), (!svc.cap_drop || !svc.cap_drop.includes("ALL")) && findings.push({
        id: "SC-EXEC-005",
        severity: "MEDIUM",
        category: "execution",
        title: `Docker service "${svcName}" retains Linux capabilities`,
        description: "Container has not dropped all capabilities, increasing attack surface.",
        evidence: `Service "${svcName}": cap_drop does not include "ALL"`,
        remediation: 'Add cap_drop: ["ALL"] to the service configuration',
        autoFixable: !0,
        references: [],
        owaspAsi: "ASI05"
      }), (!svc.security_opt || !svc.security_opt.includes("no-new-privileges:true")) && findings.push({
        id: "SC-EXEC-006",
        severity: "MEDIUM",
        category: "execution",
        title: `Docker service "${svcName}" allows privilege escalation`,
        description: "Container does not have no-new-privileges set.",
        evidence: `Service "${svcName}": security_opt missing no-new-privileges:true`,
        remediation: 'Add security_opt: ["no-new-privileges:true"] to the service configuration',
        autoFixable: !0,
        references: [],
        owaspAsi: "ASI05"
      }), svc.network_mode === "host" && findings.push({
        id: "SC-EXEC-007",
        severity: "HIGH",
        category: "execution",
        title: `Docker service "${svcName}" uses host network mode`,
        description: "Container shares the host network namespace, bypassing network isolation.",
        evidence: `Service "${svcName}": network_mode = "host"`,
        remediation: 'Remove network_mode: "host" and use bridge networking',
        autoFixable: !0,
        references: [],
        owaspAsi: "ASI05"
      });
  return findings;
}
async function auditAccessControl(ctx) {
  let findings = [], channels = ctx.channels ?? [];
  for (let ch of channels)
    ch.dmPolicy === "open" && findings.push({
      id: "SC-AC-001",
      severity: "HIGH",
      category: "access-control",
      title: `Channel "${ch.name}" has open DM policy`,
      description: "Anyone can send direct messages to the agent without pairing, enabling prompt injection attacks.",
      evidence: `Channel "${ch.name}": dmPolicy = "open"`,
      remediation: 'Set dmPolicy to "pairing" for this channel',
      autoFixable: !0,
      references: [],
      owaspAsi: "ASI01"
    }), ch.groupPolicy === "open" && findings.push({
      id: "SC-AC-002",
      severity: "HIGH",
      category: "access-control",
      title: `Channel "${ch.name}" has open group policy`,
      description: "Anyone in the group can interact with the agent without restrictions.",
      evidence: `Channel "${ch.name}": groupPolicy = "open"`,
      remediation: 'Set groupPolicy to "allowlist" for this channel',
      autoFixable: !0,
      references: [],
      owaspAsi: "ASI01"
    }), ch.allowlist && ch.allowlist.includes("*") && findings.push({
      id: "SC-AC-003",
      severity: "MEDIUM",
      category: "access-control",
      title: `Channel "${ch.name}" has wildcard in allowlist`,
      description: 'Using "*" in the allowlist effectively makes the channel open to everyone.',
      evidence: `Channel "${ch.name}": allowlist contains "*"`,
      remediation: 'Replace "*" with specific user identifiers',
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI09"
    });
  for (let ch of channels)
    ch.dmPolicy !== "pairing" && (!ch.allowlist || ch.allowlist.length === 0) && findings.push({
      id: "SC-AC-004",
      severity: "HIGH",
      category: "access-control",
      title: `Channel "${ch.name}" has no pairing and no allowlist`,
      description: "Neither pairing nor an allowlist is configured, leaving the channel unprotected.",
      evidence: `Channel "${ch.name}": dmPolicy = "${ch.dmPolicy ?? "undefined"}", allowlist empty`,
      remediation: 'Set dmPolicy to "pairing" or configure an allowlist',
      autoFixable: !0,
      references: [],
      owaspAsi: "ASI01"
    });
  return ctx.config.session?.dmScope !== "per-channel-peer" && channels.length > 1 && findings.push({
    id: "SC-AC-005",
    severity: "MEDIUM",
    category: "access-control",
    title: "Session DM scope not isolated per user",
    description: 'session.dmScope is not "per-channel-peer". With multiple users, context may leak between conversations.',
    evidence: `session.dmScope = "${ctx.config.session?.dmScope ?? "undefined"}", channels: ${channels.length}`,
    remediation: 'Set session.dmScope to "per-channel-peer"',
    autoFixable: !0,
    references: [],
    owaspAsi: "ASI09"
  }), findings;
}
async function auditSupplyChain(ctx) {
  let findings = [], skills = ctx.skills ?? [];
  findings.push({
    id: "SC-SKILL-001",
    severity: "INFO",
    category: "supply-chain",
    title: `${skills.length} skill(s) installed`,
    description: `Found ${skills.length} installed skills. Each skill has access to agent capabilities.`,
    evidence: `Installed skills: ${skills.map((s) => s.name).join(", ") || "none"}`,
    remediation: "Review each installed skill for necessity and trustworthiness",
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI04"
  });
  for (let skill of skills) {
    let skillDir = path.join(ctx.stateDir, "skills", skill.name), skillFiles = [];
    try {
      skillFiles = await ctx.listDir(skillDir);
    } catch {
      continue;
    }
    for (let file of skillFiles) {
      let filePath = path.join(skillDir, file), content = await ctx.readFile(filePath);
      if (!content) continue;
      for (let { pattern, description } of DANGEROUS_SKILL_PATTERNS)
        pattern.test(content) && findings.push({
          id: "SC-SKILL-002",
          severity: "HIGH",
          category: "supply-chain",
          title: `Dangerous pattern in skill "${skill.name}"`,
          description: `Found ${description} in ${file}. This may indicate malicious behavior.`,
          evidence: `${filePath}: matches ${pattern.source}`,
          remediation: "Review the skill source code and remove if suspicious",
          autoFixable: !1,
          references: [],
          owaspAsi: "ASI04"
        });
      let fileHash = hashString(content), db2;
      try {
        db2 = await loadIOCDatabase();
      } catch {
        continue;
      }
      let campaign = isKnownMaliciousHash(db2, fileHash);
      campaign && findings.push({
        id: "SC-SKILL-003",
        severity: "CRITICAL",
        category: "supply-chain",
        title: `Known malicious file in skill "${skill.name}"`,
        description: `File ${file} matches known malicious hash from campaign "${campaign}".`,
        evidence: `SHA-256: ${fileHash}, Campaign: ${campaign}`,
        remediation: "Immediately remove this skill: openclaw skills remove " + skill.name,
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI04"
      });
    }
    skill.githubAccountAge !== void 0 && skill.githubAccountAge < 7 && findings.push({
      id: "SC-SKILL-004",
      severity: "MEDIUM",
      category: "supply-chain",
      title: `Skill "${skill.name}" from new GitHub account`,
      description: "The GitHub account that published this skill is less than 7 days old.",
      evidence: `Account age: ${skill.githubAccountAge} days`,
      remediation: "Review the skill carefully \u2014 new accounts are commonly used for typosquatting attacks",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI04"
    });
    let db;
    try {
      db = await loadIOCDatabase();
    } catch {
      continue;
    }
    matchesTyposquat(db, skill.name) && findings.push({
      id: "SC-SKILL-005",
      severity: "HIGH",
      category: "supply-chain",
      title: `Skill "${skill.name}" matches typosquat pattern`,
      description: "This skill name matches known ClawHavoc typosquatting patterns.",
      evidence: `Skill name: ${skill.name}`,
      remediation: "Verify this is the intended skill and not a malicious impersonator",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI04"
    });
  }
  for (let skill of skills) {
    let skillDir = path.join(ctx.stateDir, "skills", skill.name), readmePath = path.join(skillDir, "README.md"), readme = await ctx.readFile(readmePath);
    if (readme) {
      let db;
      try {
        db = await loadIOCDatabase();
      } catch {
        continue;
      }
      let dangerousMatches = matchesDangerousPattern(db, readme);
      dangerousMatches.length > 0 && findings.push({
        id: "SC-SKILL-006",
        severity: "HIGH",
        category: "supply-chain",
        title: `Skill "${skill.name}" has dangerous prerequisites`,
        description: `README contains dangerous prerequisite patterns: ${dangerousMatches.join(", ")}`,
        evidence: `Patterns found: ${dangerousMatches.join(", ")}`,
        remediation: "Do not follow these prerequisites blindly. Review each step manually.",
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI04"
      });
    }
  }
  return findings;
}
async function auditMemoryIntegrity(ctx) {
  let findings = [], agentsDir = path.join(ctx.stateDir, "agents"), agents = [];
  try {
    agents = await ctx.listDir(agentsDir);
  } catch {
    return findings.push({
      id: "SC-MEM-001",
      severity: "INFO",
      category: "memory",
      title: "No agents directory found",
      description: "No agents directory exists to check memory integrity.",
      evidence: `Path: ${agentsDir}`,
      remediation: "No action needed if this is a fresh installation",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI06"
    }), findings;
  }
  let memoryFileNames = ["soul.md", "SOUL.md", "MEMORY.md"];
  for (let agent of agents) {
    for (let memFile of memoryFileNames) {
      let memPath = path.join(agentsDir, agent, memFile), content = await ctx.readFile(memPath);
      if (!content) continue;
      for (let pattern of PROMPT_INJECTION_PATTERNS)
        pattern.test(content) && findings.push({
          id: "SC-MEM-002",
          severity: "CRITICAL",
          category: "memory",
          title: `Prompt injection detected in "${memFile}" for agent "${agent}"`,
          description: `Memory file contains prompt injection pattern: "${pattern.source}". This may be a time-shifted logic bomb.`,
          evidence: `File: ${memPath}, Pattern: ${pattern.source}`,
          remediation: "Quarantine this memory file: openclaw secureclaw memory quarantine",
          autoFixable: !1,
          references: [],
          owaspAsi: "ASI06"
        });
      BASE64_BLOCK_PATTERN.test(content) && findings.push({
        id: "SC-MEM-003",
        severity: "MEDIUM",
        category: "memory",
        title: `Base64 encoded content in "${memFile}" for agent "${agent}"`,
        description: "Memory file contains long base64-encoded blocks which may hide malicious instructions.",
        evidence: `File: ${memPath}`,
        remediation: "Review and decode the base64 content to verify it is benign",
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI06"
      });
      let urlPattern = /https?:\/\/[^\s"'<>]+/g, urls = content.match(urlPattern) ?? [], allowedDomains = ctx.config.secureclaw?.network?.egressAllowlist ?? [
        "api.anthropic.com",
        "api.openai.com",
        "generativelanguage.googleapis.com"
      ];
      for (let url of urls)
        try {
          let urlObj = new URL(url);
          allowedDomains.some((d) => urlObj.hostname === d || urlObj.hostname.endsWith("." + d)) || findings.push({
            id: "SC-MEM-004",
            severity: "MEDIUM",
            category: "memory",
            title: `Unexpected URL in memory file "${memFile}"`,
            description: `Memory file contains a URL to a non-whitelisted domain: ${urlObj.hostname}`,
            evidence: `File: ${memPath}, URL: ${url}`,
            remediation: "Review if this URL is expected and add to allowlist if legitimate",
            autoFixable: !1,
            references: [],
            owaspAsi: "ASI10"
          });
        } catch {
        }
    }
    for (let memFile of memoryFileNames) {
      let memPath = path.join(agentsDir, agent, memFile);
      if (!await ctx.fileExists(memPath)) continue;
      let perms = await ctx.getFilePermissions(memPath);
      perms !== null && (perms & 63) !== 0 && findings.push({
        id: "SC-MEM-005",
        severity: "MEDIUM",
        category: "memory",
        title: `Memory file "${memFile}" has excessive permissions`,
        description: "Memory file is readable by group/other users, enabling unauthorized modification.",
        evidence: `${memPath}: permissions ${perms.toString(8)}`,
        remediation: `Run: chmod 600 ${memPath}`,
        autoFixable: !0,
        references: [],
        owaspAsi: "ASI06"
      });
    }
  }
  return findings;
}
async function auditCostExposure(ctx) {
  let findings = [], envContent = await ctx.readFile(path.join(ctx.stateDir, ".env"));
  envContent !== null && (envContent.includes("SPENDING_LIMIT") || envContent.includes("MAX_BUDGET") || envContent.includes("COST_LIMIT")) || findings.push({
    id: "SC-COST-001",
    severity: "MEDIUM",
    category: "cost",
    title: "No LLM provider spending limits configured",
    description: "No spending limit environment variables found. Runaway API costs are possible.",
    evidence: "No SPENDING_LIMIT, MAX_BUDGET, or COST_LIMIT variables in .env",
    remediation: "Set spending limits via your LLM provider dashboard and add SPENDING_LIMIT to .env",
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI08"
  });
  let sessionLogs = ctx.sessionLogs ?? [], totalTokens = 0, totalCost = 0;
  for (let logContent of sessionLogs) {
    let lines = logContent.split(`
`).filter(Boolean);
    for (let line of lines)
      try {
        let entry = JSON.parse(line);
        entry.inputTokens && (totalTokens += entry.inputTokens), entry.outputTokens && (totalTokens += entry.outputTokens), entry.estimatedCostUsd && (totalCost += entry.estimatedCostUsd);
      } catch {
      }
  }
  totalCost > 0 && findings.push({
    id: "SC-COST-002",
    severity: "INFO",
    category: "cost",
    title: "API cost usage detected in session logs",
    description: `Estimated total cost from recent sessions: $${totalCost.toFixed(2)} (${totalTokens} tokens)`,
    evidence: `Total tokens: ${totalTokens}, Estimated cost: $${totalCost.toFixed(2)}`,
    remediation: "Configure cost monitoring: openclaw secureclaw cost-report --set-limit",
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI08"
  });
  let cronConfig = await ctx.readFile(path.join(ctx.stateDir, "crontab"));
  cronConfig && /(\*\/[1-4]\s|\*\s\*\s\*\s\*\s\*)/.test(cronConfig) && findings.push({
    id: "SC-COST-003",
    severity: "HIGH",
    category: "cost",
    title: "High-frequency agent invocation detected",
    description: "Cron jobs invoke the agent every few minutes. This can cause significant API costs.",
    evidence: "Crontab contains high-frequency schedules",
    remediation: "Increase the cron interval to at least every 15 minutes, or use event-driven triggers",
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI08"
  });
  let dailyThreshold = ctx.config.secureclaw?.cost?.dailyLimitUsd ?? 5;
  return totalCost > dailyThreshold && findings.push({
    id: "SC-COST-004",
    severity: "HIGH",
    category: "cost",
    title: "Daily cost threshold exceeded",
    description: `Estimated daily cost ($${totalCost.toFixed(2)}) exceeds threshold ($${dailyThreshold}).`,
    evidence: `Daily cost: $${totalCost.toFixed(2)}, Threshold: $${dailyThreshold}`,
    remediation: "Review session logs for unexpected usage. Consider enabling the cost circuit breaker.",
    autoFixable: !1,
    references: [],
    owaspAsi: "ASI08"
  }), findings;
}
async function auditIOC(ctx) {
  let findings = [], db;
  try {
    db = await loadIOCDatabase();
  } catch {
    return findings.push({
      id: "SC-IOC-000",
      severity: "INFO",
      category: "ioc",
      title: "IOC database not available",
      description: "Could not load the IOC database. Threat intelligence checks skipped.",
      evidence: "IOC database file not found or corrupted",
      remediation: "Ensure ioc/indicators.json exists and is valid JSON",
      autoFixable: !1,
      references: [],
      owaspAsi: "ASI04"
    }), findings;
  }
  let connectionLogs = ctx.connectionLogs ?? [];
  for (let logEntry of connectionLogs) {
    let ipPattern = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, match;
    for (; (match = ipPattern.exec(logEntry)) !== null; ) {
      let ip = match[1];
      isKnownC2(db, ip) && findings.push({
        id: "SC-IOC-001",
        severity: "CRITICAL",
        category: "ioc",
        title: "Connection to known C2 infrastructure detected",
        description: `Outbound connection to known command-and-control IP: ${ip}`,
        evidence: `IP: ${ip}, Log entry: ${logEntry.substring(0, 200)}`,
        remediation: "Immediately investigate this connection. Block the IP and check for compromise.",
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI04"
      });
    }
  }
  let skills = ctx.skills ?? [];
  for (let skill of skills)
    if (skill.source)
      try {
        let url = new URL(skill.source);
        isKnownMaliciousDomain(db, url.hostname) && findings.push({
          id: "SC-IOC-002",
          severity: "CRITICAL",
          category: "ioc",
          title: `Skill "${skill.name}" references malicious domain`,
          description: `Skill source URL references a known malicious domain: ${url.hostname}`,
          evidence: `Skill: ${skill.name}, Source: ${skill.source}`,
          remediation: "Remove this skill immediately: openclaw skills remove " + skill.name,
          autoFixable: !1,
          references: [],
          owaspAsi: "ASI04"
        });
      } catch {
      }
  for (let skill of skills) {
    let skillDir = path.join(ctx.stateDir, "skills", skill.name), files;
    try {
      files = await ctx.listDir(skillDir);
    } catch {
      continue;
    }
    for (let file of files) {
      let content = await ctx.readFile(path.join(skillDir, file));
      if (!content) continue;
      let hash = hashString(content), campaign = isKnownMaliciousHash(db, hash);
      campaign && findings.push({
        id: "SC-IOC-003",
        severity: "CRITICAL",
        category: "ioc",
        title: `Malicious file detected in skill "${skill.name}"`,
        description: `File ${file} matches known malicious hash from "${campaign}" campaign.`,
        evidence: `SHA-256: ${hash}, Campaign: ${campaign}`,
        remediation: "Remove this skill and investigate for further compromise",
        autoFixable: !1,
        references: [],
        owaspAsi: "ASI04"
      });
    }
  }
  if (ctx.platform === "darwin") {
    let macosArtifacts = getInfostealerArtifacts(db, "darwin");
    for (let artifactPattern of macosArtifacts) {
      let expandedPath = artifactPattern.replace("~", os.homedir()), dirPath = path.dirname(expandedPath);
      try {
        let dirEntries = await ctx.listDir(dirPath), regex = new RegExp(path.basename(artifactPattern));
        for (let entry of dirEntries)
          regex.test(entry) && findings.push({
            id: "SC-IOC-004",
            severity: "CRITICAL",
            category: "ioc",
            title: "Potential infostealer artifact detected (macOS)",
            description: "Found suspicious file matching Atomic Stealer (AMOS) artifact pattern.",
            evidence: `File: ${path.join(dirPath, entry)}, Pattern: ${artifactPattern}`,
            remediation: "Investigate this file immediately. Run a full malware scan.",
            autoFixable: !1,
            references: [],
            owaspAsi: "ASI10"
          });
      } catch {
      }
    }
  }
  if (ctx.platform === "linux") {
    let linuxArtifacts = getInfostealerArtifacts(db, "linux");
    for (let artifactPattern of linuxArtifacts) {
      let expandedPath = artifactPattern.replace("~", os.homedir()), dirPath = path.dirname(expandedPath);
      try {
        let dirEntries = await ctx.listDir(dirPath), regex = new RegExp(path.basename(artifactPattern));
        for (let entry of dirEntries)
          regex.test(entry) && findings.push({
            id: "SC-IOC-005",
            severity: "CRITICAL",
            category: "ioc",
            title: "Potential infostealer artifact detected (Linux)",
            description: "Found suspicious file matching Redline/Lumma/Vidar infostealer artifact pattern.",
            evidence: `File: ${path.join(dirPath, entry)}, Pattern: ${artifactPattern}`,
            remediation: "Investigate this file immediately. Run a full malware scan.",
            autoFixable: !1,
            references: [],
            owaspAsi: "ASI10"
          });
      } catch {
      }
    }
  }
  return findings;
}
async function runAudit(options = {}) {
  let ctx = options.context;
  if (!ctx)
    throw new Error("AuditContext is required. Provide it via options.context");
  let deep = options.deep ?? !1, [
    gatewayFindings,
    credentialFindings,
    executionFindings,
    accessControlFindings,
    supplyChainFindings,
    memoryFindings,
    costFindings,
    iocFindings
  ] = await Promise.all([
    auditGateway(ctx, deep),
    auditCredentials(ctx),
    auditExecution(ctx),
    auditAccessControl(ctx),
    auditSupplyChain(ctx),
    auditMemoryIntegrity(ctx),
    auditCostExposure(ctx),
    auditIOC(ctx)
  ]), allFindings = [
    ...gatewayFindings,
    ...credentialFindings,
    ...executionFindings,
    ...accessControlFindings,
    ...supplyChainFindings,
    ...memoryFindings,
    ...costFindings,
    ...iocFindings
  ], score = calculateScore(allFindings), summary = computeSummary(allFindings);
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    openclawVersion: ctx.openclawVersion,
    secureclawVersion: "1.0.0",
    platform: ctx.platform,
    deploymentMode: ctx.deploymentMode,
    score,
    findings: allFindings,
    summary
  };
}

// reporters/console-reporter.ts
var RESET = "\x1B[0m", BOLD = "\x1B[1m", DIM = "\x1B[2m", RED = "\x1B[31m", GREEN = "\x1B[32m", YELLOW = "\x1B[33m", BLUE = "\x1B[34m", MAGENTA = "\x1B[35m", CYAN = "\x1B[36m", WHITE = "\x1B[37m", BG_RED = "\x1B[41m", BG_GREEN = "\x1B[42m";
var SEVERITY_COLORS = {
  CRITICAL: `${BG_RED}${WHITE}${BOLD}`,
  HIGH: `${RED}${BOLD}`,
  MEDIUM: `${YELLOW}`,
  LOW: `${BLUE}`,
  INFO: `${DIM}`
}, SEVERITY_ICONS = {
  CRITICAL: "!!!",
  HIGH: "!!",
  MEDIUM: "!",
  LOW: "-",
  INFO: "i"
};
function getGrade(score) {
  return score >= 90 ? { letter: "A", color: BG_GREEN + WHITE + BOLD } : score >= 75 ? { letter: "B", color: GREEN + BOLD } : score >= 60 ? { letter: "C", color: YELLOW + BOLD } : score >= 40 ? { letter: "D", color: RED + BOLD } : { letter: "F", color: BG_RED + WHITE + BOLD };
}
function formatFinding(finding) {
  let color = SEVERITY_COLORS[finding.severity], icon = SEVERITY_ICONS[finding.severity], fixLabel = finding.autoFixable ? ` ${GREEN}[auto-fixable]${RESET}` : "", lines = [];
  return lines.push(`  ${color}[${icon}] ${finding.severity}${RESET} ${BOLD}${finding.title}${RESET}${fixLabel}`), lines.push(`      ${DIM}ID: ${finding.id} | Category: ${finding.category} | OWASP: ${finding.owaspAsi}${RESET}`), lines.push(`      ${finding.description}`), lines.push(`      ${CYAN}Evidence:${RESET} ${finding.evidence}`), lines.push(`      ${GREEN}Fix:${RESET} ${finding.remediation}`), finding.references.length > 0 && lines.push(`      ${DIM}References: ${finding.references.join(", ")}${RESET}`), lines.join(`
`);
}
function formatConsoleReport(report) {
  let lines = [], grade = getGrade(report.score);
  lines.push(""), lines.push(`${BOLD}${MAGENTA}========================================${RESET}`), lines.push(`${BOLD}${MAGENTA}  SecureClaw Security Audit Report${RESET}`), lines.push(`${BOLD}${MAGENTA}========================================${RESET}`), lines.push(""), lines.push(`  ${BOLD}Score:${RESET} ${grade.color} ${report.score}/100 (${grade.letter}) ${RESET}`), lines.push(`  ${BOLD}Time:${RESET}  ${report.timestamp}`), lines.push(`  ${BOLD}Platform:${RESET} ${report.platform}`), lines.push(`  ${BOLD}OpenClaw:${RESET} ${report.openclawVersion}`), lines.push(`  ${BOLD}Mode:${RESET} ${report.deploymentMode}`), lines.push("");
  let severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"], grouped = /* @__PURE__ */ new Map();
  for (let sev of severityOrder)
    grouped.set(sev, []);
  for (let finding of report.findings)
    grouped.get(finding.severity)?.push(finding);
  for (let severity of severityOrder) {
    let findings = grouped.get(severity) ?? [];
    if (findings.length === 0) continue;
    let color = SEVERITY_COLORS[severity];
    lines.push(`${color}--- ${severity} (${findings.length}) ---${RESET}`), lines.push("");
    for (let finding of findings)
      lines.push(formatFinding(finding)), lines.push("");
  }
  return lines.push(`${BOLD}${MAGENTA}--- Summary ---${RESET}`), lines.push(""), lines.push(`  ${BG_RED}${WHITE} CRITICAL ${RESET} ${report.summary.critical}`), lines.push(`  ${RED}${BOLD} HIGH     ${RESET} ${report.summary.high}`), lines.push(`  ${YELLOW} MEDIUM   ${RESET} ${report.summary.medium}`), lines.push(`  ${BLUE} LOW      ${RESET} ${report.summary.low}`), lines.push(`  ${DIM} INFO     ${RESET} ${report.summary.info}`), lines.push(""), lines.push(`  ${GREEN}Auto-fixable:${RESET} ${report.summary.autoFixable} finding(s)`), lines.push(`  ${DIM}Review auto-fixable findings above and apply fixes manually${RESET}`), lines.push(""), lines.join(`
`);
}

// reporters/json-reporter.ts
function formatJsonReport(report) {
  return JSON.stringify(report, null, 2);
}

// monitors/skill-scanner.ts
import * as fs from "node:fs/promises";
import * as path2 from "node:path";
var DANGEROUS_PATTERNS = [
  { pattern: /child_process/, description: "child_process import", severity: "critical" },
  { pattern: /\.exec\s*\(/, description: "exec() call", severity: "critical" },
  { pattern: /\.spawn\s*\(/, description: "spawn() call", severity: "critical" },
  { pattern: /eval\s*\(/, description: "eval() call", severity: "critical" },
  { pattern: /Function\s*\(/, description: "Function() constructor", severity: "critical" },
  { pattern: /webhook\.site/, description: "webhook.site exfiltration", severity: "critical" },
  { pattern: /reverse.shell/, description: "reverse shell pattern", severity: "critical" },
  { pattern: /base64.*decode/i, description: "base64 decode (obfuscation)", severity: "high" },
  { pattern: /curl\s+.*\|\s*sh/, description: "curl pipe to shell", severity: "critical" },
  { pattern: /wget\s+.*\|\s*sh/, description: "wget pipe to shell", severity: "critical" },
  { pattern: /~\/\.openclaw/, description: "openclaw config access", severity: "high" },
  { pattern: /~\/\.clawdbot/, description: "legacy clawdbot config access", severity: "high" },
  { pattern: /creds\.json/, description: "credential file access", severity: "high" },
  { pattern: /\.env/, description: ".env file access", severity: "medium" },
  { pattern: /auth-profiles/, description: "auth-profiles access", severity: "high" },
  { pattern: /LD_PRELOAD/, description: "LD_PRELOAD injection", severity: "critical" },
  { pattern: /DYLD_INSERT/, description: "DYLD_INSERT injection", severity: "critical" },
  { pattern: /NODE_OPTIONS/, description: "NODE_OPTIONS injection", severity: "high" }
];
function scanContent(content) {
  let matches = [];
  for (let { pattern, description, severity } of DANGEROUS_PATTERNS)
    pattern.test(content) && matches.push({
      pattern: pattern.source,
      description,
      severity
    });
  return matches;
}
async function scanSkill(skillDir, skillName) {
  let findings = [], dangerousPatterns = [], iocMatches = [], safe = !0, db;
  try {
    db = await loadIOCDatabase();
  } catch {
    db = {
      version: "0",
      last_updated: "",
      c2_ips: [],
      malicious_domains: [],
      malicious_skill_hashes: {},
      typosquat_patterns: [],
      dangerous_prerequisite_patterns: [],
      infostealer_artifacts: { macos: [], linux: [] }
    };
  }
  matchesTyposquat(db, skillName) && (findings.push(`Skill name "${skillName}" matches known typosquat pattern`), iocMatches.push(`typosquat:${skillName}`), safe = !1);
  let files;
  try {
    files = await fs.readdir(skillDir);
  } catch {
    return findings.push(`Could not read skill directory: ${skillDir}`), safe = !1, { safe, skillName, findings, dangerousPatterns, iocMatches };
  }
  for (let file of files) {
    let filePath = path2.join(skillDir, file), stat3;
    try {
      stat3 = await fs.stat(filePath);
    } catch {
      continue;
    }
    if (!stat3.isFile()) continue;
    let content;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }
    let matches = scanContent(content);
    for (let match of matches)
      findings.push(`${file}: ${match.description} (${match.severity})`), dangerousPatterns.push(match.pattern), match.severity === "critical" && (safe = !1);
    let fileHash = hashString(content), campaign = isKnownMaliciousHash(db, fileHash);
    campaign && (findings.push(`${file}: matches known malicious hash (campaign: ${campaign})`), iocMatches.push(`hash:${fileHash}:${campaign}`), safe = !1);
  }
  return { safe, skillName, findings, dangerousPatterns, iocMatches };
}

// cli.ts
var VERSION = "1.0.1";
async function createAuditContext(stateDir, config) {
  let loadedConfig = config;
  if (!loadedConfig)
    try {
      let configContent = await fs2.readFile(path3.join(stateDir, "openclaw.json"), "utf-8");
      loadedConfig = JSON.parse(configContent);
    } catch {
      loadedConfig = {};
    }
  return {
    stateDir,
    config: loadedConfig,
    platform: `${os2.platform()}-${os2.arch()}`,
    deploymentMode: "native",
    openclawVersion: "unknown",
    async fileInfo(filePath) {
      try {
        let stat3 = await fs2.stat(filePath);
        return { path: filePath, permissions: stat3.mode & 511, exists: !0, size: stat3.size };
      } catch {
        return { path: filePath, exists: !1 };
      }
    },
    async readFile(filePath) {
      try {
        return await fs2.readFile(filePath, "utf-8");
      } catch {
        return null;
      }
    },
    async listDir(dirPath) {
      return fs2.readdir(dirPath);
    },
    async fileExists(filePath) {
      try {
        return await fs2.access(filePath), !0;
      } catch {
        return !1;
      }
    },
    async getFilePermissions(filePath) {
      try {
        return (await fs2.stat(filePath)).mode & 511;
      } catch {
        return null;
      }
    }
  };
}
async function cmdAudit(args) {
  let jsonOutput = args.includes("--json"), deep = args.includes("--deep"), stateDir = process.env.OPENCLAW_STATE_DIR ?? path3.join(os2.homedir(), ".openclaw"), ctx = await createAuditContext(stateDir), report = await runAudit({ deep, context: ctx });
  console.log(jsonOutput ? formatJsonReport(report) : formatConsoleReport(report)), report.summary.critical > 0 && (process.exitCode = 1);
}
async function cmdScanSkill(args) {
  let skillName = args.find((a) => !a.startsWith("--"));
  if (!skillName) {
    console.error("usage: secureclaw-audit scan-skill <skill-name>"), process.exitCode = 1;
    return;
  }
  let stateDir = process.env.OPENCLAW_STATE_DIR ?? path3.join(os2.homedir(), ".openclaw"), skillDir = path3.join(stateDir, "skills", skillName), result = await scanSkill(skillDir, skillName);
  result.safe ? console.log(`skill "${skillName}" passed security scan.`) : (console.log(`WARNING: skill "${skillName}" has security concerns:`), process.exitCode = 1);
  for (let finding of result.findings)
    console.log(`  - ${finding}`);
}
async function cmdStatus() {
  let stateDir = process.env.OPENCLAW_STATE_DIR ?? path3.join(os2.homedir(), ".openclaw"), ctx = await createAuditContext(stateDir), report = await runAudit({ context: ctx });
  console.log(`secureclaw v${VERSION}`), console.log(`score: ${report.score}/100`), console.log(`critical: ${report.summary.critical} | high: ${report.summary.high} | medium: ${report.summary.medium} | low: ${report.summary.low}`), console.log(`auto-fixable: ${report.summary.autoFixable}`), console.log(`platform: ${report.platform}`), console.log(`state dir: ${stateDir}`);
}
async function main() {
  let args = process.argv.slice(2), command = args[0];
  switch (command) {
    case "audit":
      await cmdAudit(args.slice(1));
      break;
    case "scan-skill":
      await cmdScanSkill(args.slice(1));
      break;
    case "status":
      await cmdStatus();
      break;
    case "--version":
    case "-v":
      console.log(`secureclaw v${VERSION}`);
      break;
    case "--help":
    case "-h":
    case void 0:
      console.log(`secureclaw v${VERSION} \u2014 security audit for openclaw`), console.log(""), console.log("usage:"), console.log("  secureclaw-audit audit [--json] [--deep]   run security audit"), console.log("  secureclaw-audit scan-skill <name>         scan a skill for threats"), console.log("  secureclaw-audit status                    quick security summary"), console.log(""), console.log("env:"), console.log("  OPENCLAW_STATE_DIR    override state directory (default: ~/.openclaw)");
      break;
    default:
      console.error(`unknown command: ${command}`), console.error("run with --help for usage"), process.exitCode = 1;
  }
}
main().catch((err) => {
  console.error("secureclaw error:", err.message ?? err), process.exitCode = 1;
});
