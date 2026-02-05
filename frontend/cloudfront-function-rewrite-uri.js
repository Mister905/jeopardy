// CloudFront Function: rewrite request URI so S3 receives the correct object.
// After editing in AWS Console: Save, then Publish so the LIVE version updates.
function handler(event) {
  var request = event.request;
  var uri = request.uri || '';
  if (!uri.startsWith('/')) uri = '/' + uri;

  if (uri.startsWith('/api') || uri.startsWith('/health') || uri.startsWith('/me')) return request;
  if (uri.includes('.')) return request;

  if (uri.toLowerCase().startsWith('/games/')) {
    request.uri = '/games/new.html';
    return request;
  }

  request.uri = uri.endsWith('/') ? uri + 'index.html' : uri + '.html';
  return request;
}
