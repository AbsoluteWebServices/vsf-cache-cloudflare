import { serverHooks } from '@vue-storefront/core/server/hooks'
import fetch from 'isomorphic-fetch'
import config from 'config'

serverHooks.beforeOutputRenderedResponse(({ res, context, output }) => {
  if (!config.get('cloudflare.cache.enabled') || !config.get('server.useOutputCacheTagging') || !context.output.cacheTags || context.output.cacheTags.size < 1) {
    return output
  }

  const tagsArray = Array.from(context.output.cacheTags)
  const cacheTags = tagsArray.join(',')
  res.setHeader('Cache-Tag', cacheTags)
  console.log(`CloudFlare's cache tags for the request: ${cacheTags}`)

  return output
})

serverHooks.afterCacheInvalidated(({ tags }) => {
  if (!config.get('cloudflare.cache.enabled') || !config.get('server.useOutputCacheTagging')) {
    return
  }

  const availableCacheTags = config.get('server.availableCacheTags') || []
  const tagsToPurge = (tags || []).filter(tag => availableCacheTags.indexOf(tag) >= 0 || availableCacheTags.some(t => tag.indexOf(t) === 0))

  if (tagsToPurge.length < 1) {
    console.error('No available cache tags specified')
    return
  }

  const apiToken = config.get('cloudflare.apiToken')
  const zoneIdentifier = config.get('cloudflare.cache.zoneIdentifier')

  if (!apiToken || !zoneIdentifier) {
    console.error('One or more config parameters are missing: cloudflare.apiToken, cloudflare.cache.zoneIdentifier')
    return
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${zoneIdentifier}/purge_cache`

  fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ tags: tagsToPurge })
  }).then(response => response.json())
    .then(json => {
      if (json && json.success) {
        console.log(
          `Tags invalidated successfully for [${tagsToPurge.join(',')}] in the CloudFlare's cache`
        );
      } else {
        console.log(json)
        console.error(`Couldn't purge tags: [${tagsToPurge.join(',')}] in the CloudFlare's cache`);
      }
    })
})
