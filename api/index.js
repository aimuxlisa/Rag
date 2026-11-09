const handleRequest = require('../server.js');

module.exports = (req, res) => {
  const route = req.query && req.query.route;
  if (typeof route !== 'string' || !/^[a-z0-9/-]+$/i.test(route)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  req.url = `/api/${route}`;
  return handleRequest(req, res);
};

module.exports.config = { api: { bodyParser: false } };
