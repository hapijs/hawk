// Load modules

var Chai = require('chai');
var Hawk = process.env.TEST_COV ? require('../lib-cov') : require('../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Hawk', function () {

    var credentialsFunc = function (id, callback) {

        var credentials = {
            id: id,
            key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
            algorithm: (id === '1' ? 'sha1' : 'sha256'),
            user: 'steve'
        };

        return callback(null, credentials);
    };

    it('should generate a header then successfully parse it (configuration)', function (done) {

        var req = {
            method: 'GET',
            url: '/resource/4?filter=a',
            host: 'example.com',
            port: 8080
        };

        credentialsFunc('123456', function (err, credentials) {

            req.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, req.host, req.port, { ext: 'some-app-data' });
            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                expect(attributes.ext).to.equal('some-app-data');
                done();
            });
        });
    });

    it('should generate a header then successfully parse it (node request)', function (done) {

        var req = {
            method: 'GET',
            url: '/resource/4?filter=a',
            headers: {
                host: 'example.com:8080'
            }
        };

        credentialsFunc('123456', function (err, credentials) {

            req.headers.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, 'example.com', 8080, { ext: 'some-app-data' });
            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                expect(attributes.ext).to.equal('some-app-data');
                done();
            });
        });
    });

    it('should generate a header then successfully parse it (with hash)', function (done) {

        var req = {
            method: 'GET',
            url: '/resource/4?filter=a',
            host: 'example.com',
            port: 8080
        };

        credentialsFunc('123456', function (err, credentials) {

            req.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, req.host, req.port, { payload: 'hola!', ext: 'some-app-data' });
            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                expect(attributes.ext).to.equal('some-app-data');
                done();
            });
        });
    });

    it('should generate a header then successfully parse it then validate payload', function (done) {

        var req = {
            method: 'GET',
            url: '/resource/4?filter=a',
            host: 'example.com',
            port: 8080
        };

        credentialsFunc('123456', function (err, credentials) {

            req.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, req.host, req.port, { payload: 'hola!', ext: 'some-app-data' });
            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                expect(attributes.ext).to.equal('some-app-data');
                expect(Hawk.validatePayload('hola!', credentials, attributes.hash)).to.be.true;
                expect(Hawk.validatePayload('hello!', credentials, attributes.hash)).to.be.false;
                done();
            });
        });
    });

    it('should generate a header then fail authentication due to bad hash', function (done) {

        var req = {
            method: 'GET',
            url: '/resource/4?filter=a',
            host: 'example.com',
            port: 8080
        };

        credentialsFunc('123456', function (err, credentials) {

            req.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, req.host, req.port, { payload: 'hola!', ext: 'some-app-data' });
            Hawk.authenticate(req, credentialsFunc, { payload: 'byebye!' }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad payload hash');
                done();
            });
        });
    });

    it('should generate a header for one resource then fail to authenticate another', function (done) {

        var req = {
            method: 'GET',
            url: '/resource/4?filter=a',
            host: 'example.com',
            port: 8080
        };

        credentialsFunc('123456', function (err, credentials) {

            req.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, req.host, req.port, { ext: 'some-app-data' });
            req.url = '/something/else';

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(credentials).to.exist;
                done();
            });
        });
    });

    describe('#authenticate', function () {

        it('should parse a valid authentication header (sha1)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="1", ts="1353788437", nonce="k3j4h2", mac="zy79QQ5/EYFmQqutVnYb73gAc/U=", ext="hello"',
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should parse a valid authentication header (sha256)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/1?b=1&a=2',
                host: 'example.com',
                port: 8000,
                authorization: 'Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", mac="m8r1rHbXN6NgO+KIIhjO7sFRyd78RNGVUwehe8Cp2dU=", ext="some-app-data"',
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353832234000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should parse a valid authentication header (POST with payload)', function (done) {

            var req = {
                method: 'POST',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123456", ts="1357926341", nonce="1AwuJD", hash="qAiXIVv+yjDATneWxZP2YCTa9aHRgQdnH9b3Wc+o3dg=", ext="some-app-data", mac="UeYcj5UoTVaAWXNvJfLVia7kU3VabxCqrccXP8sUGC4="',
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1357926341000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should fail on missing hash', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/1?b=1&a=2',
                host: 'example.com',
                port: 8000,
                authorization: 'Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", mac="m8r1rHbXN6NgO+KIIhjO7sFRyd78RNGVUwehe8Cp2dU=", ext="some-app-data"',
            };

            Hawk.authenticate(req, credentialsFunc, { payload: 'body', localtimeOffsetMsec: 1353832234000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing required payload hash');
                done();
            });
        });

        it('should fail on a stale timestamp', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/1?b=1&a=2',
                host: 'example.com',
                port: 8000,
                authorization: 'Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", mac="m8r1rHbXN6NgO+KIIhjO7sFRyd78RNGVUwehe8Cp2dU=", ext="some-app-data"',
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Stale timestamp');
                var header = err.toResponse().headers['WWW-Authenticate'];
                var ts = header.match(/^Hawk ts\=\"(\d+)\"\, error=\"Stale timestamp\"$/);
                var now = Hawk.utils.now();
                expect(parseInt(ts[1], 10)).to.be.within(now - 1, now + 1);
                done();
            });
        });

        it('should fail on a replay', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="bXx7a7p1h9QYQNZ8x7QhvDQym8ACgab4m3lVSFn4DBw=", ext="hello"',
            };

            var memoryCache = {};
            var options = {
                localtimeOffsetMsec: 1353788437000 - Hawk.utils.now(),
                nonceFunc: function (nonce, ts, callback) {

                    if (memoryCache[nonce]) {
                        return callback(new Error());
                    }

                    memoryCache[nonce] = true;
                    return callback();
                }
            };

            Hawk.authenticate(req, credentialsFunc, options, function (err, credentials, attributes) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');

                Hawk.authenticate(req, credentialsFunc, options, function (err, credentials, attributes) {

                    expect(err).to.exist;
                    expect(err.toResponse().payload.message).to.equal('Invalid nonce');
                    done();
                });
            });
        });

        it('should fail on an invalid authentication header: wrong scheme', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Basic asdasdasdasd'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.not.exist;
                done();
            });
        });

        it('should fail on an invalid authentication header: no scheme', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: '!@#'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid header syntax');
                done();
            });
        });

        it('should fail on an missing authorization header', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.isMissing).to.equal(true);
                var header = err.toResponse().headers['WWW-Authenticate'];
                var ts = header.match(/^Hawk ts\=\"(\d+)\"$/);
                var now = Hawk.utils.now();
                expect(parseInt(ts[1], 10)).to.be.within(now - 1, now + 1);
                done();
            });
        });

        it('should fail on an missing host header', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
                }
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid Host header');
                done();
            });
        });

        it('should fail on an missing authorization attribute (id)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an missing authorization attribute (ts)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an missing authorization attribute (nonce)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an missing authorization attribute (mac)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an unknown authorization attribute', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", x="3", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Unknown attribute: x');
                done();
            });
        });

        it('should fail on an bad authorization header format', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123\\", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad header format');
                done();
            });
        });

        it('should fail on an bad authorization attribute value', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="\t", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad attribute value: id');
                done();
            });
        });

        it('should fail on an empty authorization attribute value', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad attribute value: id');
                done();
            });
        });

        it('should fail on duplicated authorization attribute key', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", id="456", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Duplicate attribute: id');
                done();
            });
        });

        it('should fail on an invalid authorization header format', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid header syntax');
                done();
            });
        });

        it('should fail on an bad host header (missing host)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                headers: {
                    host: ':8080',
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
                }
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid Host header');
                done();
            });
        });

        it('should fail on an bad host header (pad port)', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                headers: {
                    host: 'example.com:something',
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
                }
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid Host header');
                done();
            });
        });

        it('should fail on credentialsFunc error', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            var credentialsFunc = function (id, callback) {

                return callback(new Error('Unknown user'));
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.message).to.equal('Unknown user');
                done();
            });
        });

        it('should fail on missing credentials', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            var credentialsFunc = function (id, callback) {

                return callback(null, null);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Unknown credentials');
                done();
            });
        });

        it('should fail on invalid credentials', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid credentials');
                expect(err.toResponse().payload.message).to.equal('An internal server error occurred');
                done();
            });
        });

        it('should fail on unknown credentials algorithm', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'hmac-sha-0',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.message).to.equal('Unknown algorithm');
                expect(err.toResponse().payload.message).to.equal('An internal server error occurred');
                done();
            });
        });

        it('should fail on unknown bad mac', function (done) {

            var req = {
                method: 'GET',
                url: '/resource/4?filter=a',
                host: 'example.com',
                port: 8080,
                authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcU4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'sha256',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Hawk.utils.now() }, function (err, credentials, attributes) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad mac');
                done();
            });
        });
    });

    describe('#getAuthorizationHeader', function () {

        it('should return a valid authorization header (sha1)', function (done) {

            var credentials = {
                id: '123456',
                key: '2983d45yun89q',
                algorithm: 'sha1'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, { ext: 'Bazinga!', timestamp: 1353809207, nonce: 'Ygvqdz', payload: 'something to write about' });
            expect(header).to.equal('Hawk id="123456", ts="1353809207", nonce="Ygvqdz", hash="eQJ6qAuxoMrLdTMb5IJiv04W4F4=", ext="Bazinga!", mac="Ti2SMCBfDGp4DLoOw2OpFjOs+nI="');
            done();
        });

        it('should return a valid authorization header (sha256)', function (done) {

            var credentials = {
                id: '123456',
                key: '2983d45yun89q',
                algorithm: 'sha256'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, { ext: 'Bazinga!', timestamp: 1353809207, nonce: 'Ygvqdz', payload: 'something to write about' });
            expect(header).to.equal('Hawk id="123456", ts="1353809207", nonce="Ygvqdz", hash="Yz+K6hTiKD4IVEckK1yPIBdb/gh4LdtWwpXvM776Edg=", ext="Bazinga!", mac="Uk1EHe77nOiAo4Hgm8Qio21+MtU7jEcVSIaqw21Yy48="');
            done();
        });

        it('should return an empty authorization header on invalid credentials', function (done) {

            var credentials = {
                key: '2983d45yun89q',
                algorithm: 'sha256'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, { ext: 'Bazinga!', timestamp: 1353809207 });
            expect(header).to.equal('');
            done();
        });

        it('should return an empty authorization header on invalid algorithm', function (done) {

            var credentials = {
                id: '123456',
                key: '2983d45yun89q',
                algorithm: 'hmac-sha-0'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, { payload: 'something, anything!', ext: 'Bazinga!', timestamp: 1353809207 });
            expect(header).to.equal('');
            done();
        });
    });
});

