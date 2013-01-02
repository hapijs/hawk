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
            algorithm: (id === '1' ? 'hmac-sha-1' : 'hmac-sha-256'),
            user: 'steve'
        };

        return callback(null, credentials);
    };

    it('should generate a header then successfully parse it', function (done) {

        var req = {
            headers: {
                host: 'example.com:8080'
            },
            method: 'GET',
            url: '/resource/4?filter=a'
        };

        credentialsFunc('123456', function (err, credentials) {

            req.headers.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, 'example.com', 8080, { ext: 'some-app-data' });

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                expect(ext).to.equal('some-app-data');
                done();
            });
        });
    });

    it('should generate a header for one resource then fail to authenticate another', function (done) {

        var req = {
            headers: {
                host: 'example.com:8080'
            },
            method: 'GET',
            url: '/resource/4?filter=a'
        };

        credentialsFunc('123456', function (err, credentials) {

            req.headers.authorization = Hawk.getAuthorizationHeader(credentials, req.method, req.url, 'example.com', 8080, { ext: 'some-app-data' });
            req.url = '/something/else';

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(credentials).to.exist;
                done();
            });
        });
    });

    describe('#authenticate', function () {

        it('should parse a valid authentication header (hmac-sha-1)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="1", ts="1353788437", nonce="k3j4h2", mac="qrP6b5tiS2CO330rpjUEym/USBM=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should parse a valid authentication header (hmac-sha-256)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", mac="hpf5lg0G0rtKrT04CiRf0Q+IDjkGkyvKdMjtqu1XV/s=", ext="some-app-data"',
                    host: 'example.com:8000'
                },
                method: 'GET',
                url: '/resource/1?b=1&a=2'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353832234000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');
                done();
            });
        });

        it('should fail on a stale timestamp', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", mac="hpf5lg0G0rtKrT04CiRf0Q+IDjkGkyvKdMjtqu1XV/s=", ext="some-app-data"',
                    host: 'example.com:8000'
                },
                method: 'GET',
                url: '/resource/1?b=1&a=2'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Stale timestamp');
                var header = err.headers['WWW-Authenticate'];
                var ts = header.match(/^Hawk ts\=\"(\d+)\"\, ntp\=\"pool.ntp.org\"\, error=\"Stale timestamp\"$/);
                var now = Date.now();
                expect(parseInt(ts[1], 10)).to.be.within(now - 1, now + 1);
                done();
            });
        });

        it('should fail on a replay', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="ZPa2zWC3WUAYXrwPzJ3DpF54xjQ2ZDLe8GF1ny6JJFI=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var memoryCache = {};
            var options = {
                localtimeOffsetMsec: 1353788437000 - Date.now(),
                nonceFunc: function (nonce, ts, callback) {

                    if (memoryCache[nonce]) {
                        return callback(new Error());
                    }

                    memoryCache[nonce] = true;
                    return callback();
                }
            };

            Hawk.authenticate(req, credentialsFunc, options, function (err, credentials, ext) {

                expect(err).to.not.exist;
                expect(credentials.user).to.equal('steve');

                Hawk.authenticate(req, credentialsFunc, options, function (err, credentials, ext) {

                    expect(err).to.exist;
                    expect(err.toResponse().payload.message).to.equal('Invalid nonce');
                    done();
                });
            });
        });

        it('should fail on an invalid authentication header: wrong scheme', function (done) {

            var req = {
                headers: {
                    authorization: 'Basic asdasdasdasd',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('');
                done();
            });
        });

        it('should fail on an invalid authentication header: no scheme', function (done) {

            var req = {
                headers: {
                    authorization: '!@#',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid header syntax');
                done();
            });
        });

        it('should fail on an missing authorization header', function (done) {

            var req = {
                headers: {
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, ext) {

                expect(err).to.exist;
                var header = err.headers['WWW-Authenticate'];
                var ts = header.match(/^Hawk ts\=\"(\d+)\"\, ntp\=\"pool.ntp.org\"$/);
                var now = Date.now();
                expect(parseInt(ts[1], 10)).to.be.within(now - 1, now + 1);
                done();
            });
        });

        it('should fail on an missing host header', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid Host header');
                done();
            });
        });

        it('should fail on an missing authorization attribute (id)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an missing authorization attribute (ts)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an missing authorization attribute (nonce)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an missing authorization attribute (mac)', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Missing attributes');
                done();
            });
        });

        it('should fail on an unknown authorization attribute', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", x="3", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Unknown attribute: x');
                done();
            });
        });

        it('should fail on an bad authorization header format', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123\\", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad header format');
                done();
            });
        });

        it('should fail on an bad authorization attribute value', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="\t", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad attribute value: id');
                done();
            });
        });

        it('should fail on an empty authorization attribute value', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad attribute value: id');
                done();
            });
        });

        it('should fail on duplicated authorization attribute key', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", id="456", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Duplicate attribute: id');
                done();
            });
        });

        it('should fail on an invalid authorization header format', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid header syntax');
                done();
            });
        });

        it('should fail on an bad host header', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080:90'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Invalid Host header');
                done();
            });
        });

        it('should fail on credentialsFunc error', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                return callback(new Error('Unknown user'));
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.message).to.equal('Unknown user');
                done();
            });
        });

        it('should fail on missing credentials', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                return callback(null, null);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Unknown credentials');
                done();
            });
        });

        it('should fail on invalid credentials', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.message).to.equal('Invalid credentials');
                expect(err.toResponse().payload.message).to.equal('An internal server error occurred');
                done();
            });
        });

        it('should fail on unknown credentials algorithm', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcUyW6EEgUH4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'hmac-sha-0',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.message).to.equal('Unknown algorithm');
                expect(err.toResponse().payload.message).to.equal('An internal server error occurred');
                done();
            });
        });

        it('should fail on unknown bad mac', function (done) {

            var req = {
                headers: {
                    authorization: 'Hawk id="123", ts="1353788437", nonce="k3j4h2", mac="/qwS4UjfVWMcU4jlr7T/wuKe3dKijvTvSos=", ext="hello"',
                    host: 'example.com:8080'
                },
                method: 'GET',
                url: '/resource/4?filter=a'
            };

            var credentialsFunc = function (id, callback) {

                var credentials = {
                    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
                    algorithm: 'hmac-sha-256',
                    user: 'steve'
                };

                return callback(null, credentials);
            };

            Hawk.authenticate(req, credentialsFunc, { localtimeOffsetMsec: 1353788437000 - Date.now() }, function (err, credentials, ext) {

                expect(err).to.exist;
                expect(err.toResponse().payload.message).to.equal('Bad mac');
                done();
            });
        });
    });

    describe('#getAuthorizationHeader', function () {

        it('should return a valid authorization header', function (done) {

            var credentials = {
                id: '123456',
                key: '2983d45yun89q',
                algorithm: 'hmac-sha-256'
            };

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, { ext: 'Bazinga!', timestamp: 1353809207, nonce: 'Ygvqdz' });
            expect(header).to.equal('Hawk id="123456", ts="1353809207", nonce="Ygvqdz", ext="Bazinga!", mac="qSK1cZEkqPwE2ttBX8QSXxO+NE3epFMu4tyVpGKjdnU="');
            done();
        });

        it('should return an empty authorization header on invalid credentials', function (done) {

            var credentials = {
                key: '2983d45yun89q',
                algorithm: 'hmac-sha-256'
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

            var header = Hawk.getAuthorizationHeader(credentials, 'POST', '/somewhere/over/the/rainbow', 'example.net', 443, { ext: 'Bazinga!', timestamp: 1353809207 });
            expect(header).to.equal('');
            done();
        });
    });
});

