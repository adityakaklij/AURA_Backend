# Neynar Hub API – Fetch Feed

## Endpoint  
**GET** `https://api.neynar.com/v2/farcaster/feed/`

## Description  
Fetch a feed of casts (posts) from the Farcaster network, filtered by various criteria.  

## Authorization  
- Header `x-api-key`: *string* (required) — your API key. :contentReference[oaicite:1]{index=1}  
- Optional header `x-neynar-experimental`: *boolean* — enable experimental features (e.g., filtering by Neynar score). :contentReference[oaicite:2]{index=2}  

## Query Parameters  

| Name           | Type             | Default        | Description                                                                                      |
|----------------|------------------|----------------|--------------------------------------------------------------------------------------------------|
| `feed_type`    | enum<string>     | `following`    | The type of feed to return — `"following"` (default) or `"filter"`. :contentReference[oaicite:3]{index=3} |
| `filter_type`  | enum<string>     | —              | Used when `feed_type=filter`. Options: `fids`, `parent_url`, `channel_id`, `embed_url`, `embed_types`, `global_trending`. :contentReference[oaicite:4]{index=4} |
| `fid`          | integer          | —              | User FID whose feed you want (when `feed_type=following`). :contentReference[oaicite:5]{index=5} |
| `fids`         | string           | —              | Comma-separated list of FIDs (max 100) when `filter_type=fids`. :contentReference[oaicite:6]{index=6} |
| `parent_url`   | string           | —              | Parent URL filter when `filter_type=parent_url`. :contentReference[oaicite:7]{index=7} |
| `channel_id`   | string           | —              | Filter by channel when `filter_type=channel_id`. :contentReference[oaicite:8]{index=8} |
| `embed_url`    | string           | —              | Filter by embedded URL prefix when `filter_type=embed_url`. :contentReference[oaicite:9]{index=9} |
| `embed_types`  | enum<string>[]   | —              | Filter by embed types when `filter_type=embed_types`. :contentReference[oaicite:10]{index=10} |
| `with_recasts` | boolean |null    | `true`         | Whether to include recasts in the results (true by default). :contentReference[oaicite:11]{index=11} |
| `limit`        | integer          | `25`           | Number of results to fetch (1 ≤ limit ≤ 100). :contentReference[oaicite:12]{index=12} |
| `cursor`       | string           | —              | Pagination cursor for fetching next page. :contentReference[oaicite:13]{index=13} |
| `viewer_fid`   | integer          | —              | The FID of the viewer to respect their mutes/blocks (adds `viewer_context`). :contentReference[oaicite:14]{index=14} |

## Response  
- `200 OK` returns JSON:  
  ```json
  {
    "casts": [ { /* cast object */ }, … ],
    "next": { "cursor": "<string>" }
  }
  ``` :contentReference[oaicite:15]{index=15}  
- Each cast object includes metadata like `hash`, `author`, `text`, `timestamp`, `embeds`, `reactions`, etc. :contentReference[oaicite:16]{index=16}  

## Example  
```bash
curl --request GET \
  --url https://api.neynar.com/v2/farcaster/feed/?limit=100 \
  --header 'x-api-key: YOUR_API_KEY'
