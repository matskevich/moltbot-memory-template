---
name: dual-search
type: skill
version: v1.0
description: "Dual search strategy: Exa + Brave, merge & compare"
---

# Dual Search Skill

## Purpose

Execute same query via Exa API and Brave Search (web_search), merge results, track source coverage.

## Inputs

- `query`: Search query string
- `max_results`: Max results per API (default: 10)
- `max_chars`: Max chars for Exa crawl (default: 20000)

## Outputs

```json
{
  "query": "...",
  "results": [
    {
      "url": "https://...",
      "title": "...",
      "snippet": "...",
      "source_api": "exa|brave",
      "published_date": "...",
      "score": 0.95
    }
  ],
  "coverage": {
    "exa_only": 3,
    "brave_only": 5,
    "overlap": 2,
    "total_unique": 10
  },
  "api_comparison": {
    "exa": {"count": 5, "avg_quality": 0.8},
    "brave": {"count": 7, "avg_quality": 0.75}
  }
}
```

## Implementation

```bash
#!/bin/bash
query="$1"
max_results="${2:-10}"
max_chars="${3:-20000}"

# 1. Exa search
exa_results=$(~/clawd/skills/deep-research/scripts/exa-search.sh "$query" "$max_results" "$max_chars")

# 2. Brave search (via web_search tool)
# NOTE: web_search tool должен быть вызван через assistant, не shell
# Здесь только placeholder — actual implementation в aspect-researcher

# 3. Merge logic
# - Dedupe by URL
# - Mark source_api
# - Calculate coverage

echo "$merged_json"
```

## Usage in aspect-researcher

```yaml
For each query:
  1. exa_results = exec("exa-search.sh ...")
  2. brave_results = web_search(query, count=10)
  3. merged = merge_results(exa_results, brave_results)
  4. findings = extract_from(merged)
  5. Track coverage stats
```

## Merge Algorithm

```python
def merge_results(exa, brave):
    url_map = {}
    
    # Add Exa results
    for r in exa.results:
        url_map[r.url] = {**r, "source_api": "exa"}
    
    # Add Brave results (mark overlap)
    for r in brave.results:
        if r.url in url_map:
            url_map[r.url]["source_api"] = "both"
        else:
            url_map[r.url] = {**r, "source_api": "brave"}
    
    return list(url_map.values())
```

## Coverage Metrics

Track per aspect:
- Exa-only URLs
- Brave-only URLs
- Overlap URLs
- Which API found S-tier sources
- Which API more recent results

Include in aspect output YAML:
```yaml
search_coverage:
  exa_only: 3
  brave_only: 5
  overlap: 2
  exa_avg_tier: A
  brave_avg_tier: B
```
