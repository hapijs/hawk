![hawk Logo](https://raw.github.com/hueniverse/hawk/master/images/hawk.png)

<img align="right" src="https://raw.github.com/hueniverse/hawk/master/images/logo.png" /> **Hawk** is an HTTP authentication scheme using a message authentication code (MAC) algorithm to provide partial
HTTP request cryptographic verification. For more complex use cases such as access delegation, see [Oz](/hueniverse/oz).

Current version: **0.5.3**

[![Build Status](https://secure.travis-ci.org/hueniverse/hawk.png)](http://travis-ci.org/hueniverse/hawk)

# Table of Content

- [**Introduction**](#introduction)
  - [Time Synchronization](#time-synchronization)
  - [Usage Example](#usage-example)
  - [Protocol Example](#protocol-example)
    - [Payload Validation](#payload-validation)
<p></p>
- [**Single URI Authorization**](#single-uri-authorization)
  - [Usage Example](#bewit-usage-example)
<p></p>
- [**Security Considerations**](#security-considerations)
  - [MAC Keys Transmission](#mac-keys-transmission)
  - [Confidentiality of Requests](#confidentiality-of-requests)
  - [Spoofing by Counterfeit Servers](#spoofing-by-counterfeit-servers)
  - [Plaintext Storage of Credentials](#plaintext-storage-of-credentials)
  - [Entropy of Keys](#entropy-of-keys)
  - [Coverage Limitations](#coverage-limitations)
  - [Future Time Manipulation](#future-time-manipulation)
  - [Client Clock Poisoning](#client-clock-poisoning)
  - [Bewit Limitations](#bewit-limitations)
<p></p>
- [**Frequently Asked Questions**](#frequently-asked-questions)
<p></p>
- [**Acknowledgements**](#acknowledgements)

# Introduction

**Hawk** is an HTTP authentication scheme providing mechanisms for making authenticated HTTP requests with
partial cryptographic verification of the request, covering the HTTP method, request URI, host, and optionally
the request payload.

Similar to the HTTP [Digest access authentication schemes](http://www.ietf.org/rfc/rfc2617.txt), **Hawk** uses a set of
client credentials which include a username (identifier) and password (key). Likewise, just as with the Digest scheme,
the key is never included in authenticated requests; instead, it is used to calculate a request MAC value which is
included in its place.

However, **Hawk** has several differences from Digest. In particular, while both use a nonce to limit the possibility of
replay attacks, the client generates the nonce in **Hawk** and uses it in combination with a timestamp, leading to less
interaction with the server ("chattiness").

Also unlike Digest, this scheme is not intended to protect the key itself (called the password in Digest) because
the client and server must both have access to the key material in the clear.

The primary design goals of this scheme are to:
* simplify and improve HTTP authentication for services that are unwilling or unable to deploy TLS for all resources,
* secure credentials against leakage (e.g., when the client uses some form of dynamic configuration to determine where to send an authenticated request), and
* avoid the exposure of credentials sent to a malicious server over an unauthenticated secure channel due to client failure to validate the server's identity as part of its TLS handshake.

In addition, **Hawk** supports a method for granting third-parties temporary access to individual resources using
a query parameter called _bewit_ (leather straps used to attach a tracking device to the leg of a hawk).

The **Hawk** scheme requires the establishment of a shared symmetric key between the client and the server,
which is beyond the scope of this module. Typically, the shared credentials are established via an initial
TLS-protected phase or derived from some other shared confidential information available to both the client
and the server.


## Time Synchronization

When making requests, the client includes a timestamp and nonce in order to enable the server to prevent replay
attacks. The nonce is generated by the client and is a string unique across all requests with the same timestamp and
key identifier combination. Without replay protection, an attacker can use a compromised (but otherwise valid and
authenticated) request more than once, gaining long term access to a protected resource.

Including a timestamp with the nonce removes the need to retain an infinite number of nonce values for future checks.
The timestamp enables the server to restrict the time period after which a request with an old timestamp is rejected.
However, this requires the client's clock to be in sync with the server's clock. Unlike other protocols, **Hawk**
requires the client to ensure its clock is in sync. To accomplish that, the server provides the client with its current
time in response to a bad timestamp or as part of a challenge.

In addition, to increase the protocol scalability for clients communicating with many different servers, the server
provides the name of an NTP server which can be used as a time reference for clock sync with the server.

There is no expectation that the client will adjust its system clock to match the server. In fact, that would be a
potential attack vector on the client. Instead, the client only uses the server's time to calculate an offset used only
for communications with that particular server.


## Usage Example

Server code:

```javascript
var Http = require('http');
var Hawk = require('hawk');


// Credentials lookup function

var credentialsFunc = function (id, callback) {

    var credentials = {
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256',
        user: 'Steve'
    };

    return callback(null, credentials);
};

// Create HTTP server

var handler = function (req, res) {

    Hawk.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

        res.writeHead(!err ? 200 : 401, { 'Content-Type': 'text/plain' });
        res.end(!err ? 'Hello ' + credentials.user : 'Shoosh!');
    });
};

Http.createServer(handler).listen(8000, 'example.com');
```

Client code:

```javascript
var Request = require('request');
var Hawk = require('hawk');


// Client credentials

var credentials = {
    id: 'dh37fgj492je',
    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
    algorithm: 'sha256'
}

// Send authenticated request

var options = {
    uri: 'http://example.com:8000/resource/1?b=1&a=2',
    method: 'GET',
    headers: {
        authorization: Hawk.getAuthorizationHeader(credentials, 'GET', '/resource/1?b=1&a=2', 'example.com', 8000, { ext: 'some-app-data' })
    }
};

Request(options, function (error, response, body) {

    console.log(response.statusCode + ': ' + body);
});
```


## Protocol Example

The client attempts to access a protected resource without authentication, sending the following HTTP request to
the resource server:

```
GET /resource/1?b=1&a=2 HTTP/1.1
Host: example.com:8000
```

The resource server returns an authentication challenge. The challenge provides the client with the server's current
time and NTP server used for clock sync, which enable the client to offset its clock when making requests.

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Hawk ts="1353832200", ntp="pool.ntp.org"
```

The client has previously obtained a set of **Hawk** credentials for accessing resources on the "http://example.com/"
server. The **Hawk** credentials issued to the client include the following attributes:

* Key identifier: dh37fgj492je
* Key: werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn
* Algorithm: sha256

The client generates the authentication header by calculating a timestamp (e.g. the number of seconds since January 1,
1970 00:00:00 GMT), generating a nonce, and constructing the normalized request string (newline separated values):

```
hawk.1.header
1353832234
j4h3g2
GET
/resource?a=1&b=2
example.com
8000

some-app-ext-data

```

The 'hawk.1.header' normalized string header is used to prevent MAC values from being reused after a potential change in how the
protocol creates the normalized string. For example, if a future version would switch the order of nonce and timestamp, it
can create an exploit opportunity for cases where the nonce is similar in format to a timestamp. In addition, the header
prevents switching MAC values between a header request and a bewit request.

The request MAC is calculated using HMAC with the specified hash algorithm "sha256" and the key over the normalized request string.
The result is base64-encoded to produce the request MAC:

```
6R4rV5iE+NPoym+WwjeHzjAGXUtLNIxmo1vpMofpLAE=
```

The client includes the **Hawk** key identifier, timestamp, nonce, application specific data, and request MAC with the request using
the HTTP "Authorization" request header field:

```
GET /resource/1?b=1&a=2 HTTP/1.1
Host: example.com:8000
Authorization: Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", ext="some-app-ext-data", mac="6R4rV5iE+NPoym+WwjeHzjAGXUtLNIxmo1vpMofpLAE="
```

The server validates the request by calculating the request MAC again based on the request received and verifies the validity
and scope of the **Hawk** credentials. If valid, the server responds with the requested resource.


### Payload Validation

**Hawk** provides optional payload validation. When generating the authentication header, the client calculates a payload hash
using the specified hash algorithm. The hash is calculated over the request payload prior to any content encoding (the exact
representation requirements should be specified by the server for payloads other than simple single-part ascii to ensure interoperability):

Payload: `Thank you for flying Hawk`
Hash (sha256): `CBbyqZ/H0rd6nKdg3O9FS5uiQZ5NmgcXUPLut9heuyo=`

The client constructs the normalized request string (newline separated values):

```
hawk.1.header
1353832234
j4h3g2
POST
/resource?a=1&b=2
example.com
8000
CBbyqZ/H0rd6nKdg3O9FS5uiQZ5NmgcXUPLut9heuyo=
some-app-ext-data

```

Then calculates the request MAC and includes the **Hawk** key identifier, timestamp, nonce, payload hash, application specific data,
and request MAC with the request using the HTTP "Authorization" request header field:

```
POST /resource/1 HTTP/1.1
Host: example.com:8000
Hawk id="dh37fgj492je", ts="1353832234", nonce="j4h3g2", hash="CBbyqZ/H0rd6nKdg3O9FS5uiQZ5NmgcXUPLut9heuyo=", ext="some-app-ext-data", mac="D0pHf7mKEh55AxFZ+qyiJ/fVE8uL0YgkoJjOMcOhVQU="
```


# Single URI Authorization

There are often cases in which limited and short-term access is granted to protected resource to a third party which does not
have access to the shared credentials. For example, displaying a protected image on a web page accessed by anyone. **Hawk**
provides limited support for such URIs in the form of a _bewit_ - a URI query parameter appended to the request URI which contains
the necessary credentials to authenticate the request.

Because of the significant security risks involved in issuing such access, bewit usage is purposely limited to only GET requests
and for a finite period of time. Both the client and server can issue bewit credentials, however, the server should not use the same
credentials as the client to maintain clear traceability as to who issued which credentials.

In order to simplify implementation, bewit credentials do not support single-use policy and can be replayed multiple times within
the granted access timeframe. 


## Bewit Usage Example

Server code:

```javascript
var Http = require('http');
var Hawk = require('hawk');


// Credentials lookup function

var credentialsFunc = function (id, callback) {

    var credentials = {
        key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
        algorithm: 'sha256'
    };

    return callback(null, credentials);
};

// Create HTTP server

var handler = function (req, res) {

    Hawk.uri.authenticate(req, credentialsFunc, {}, function (err, credentials, attributes) {

        res.writeHead(!err ? 200 : 401, { 'Content-Type': 'text/plain' });
        res.end(!err ? 'Access granted' : 'Shoosh!');
    });
};

Http.createServer(handler).listen(8000, 'example.com');
```

Bewit code generation:

```javascript
var Request = require('request');
var Hawk = require('hawk');


// Client credentials

var credentials = {
    id: 'dh37fgj492je',
    key: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
    algorithm: 'sha256'
}

// Generate bewit

var duration = 60 * 5;      // 5 Minutes
var bewit = Hawk.uri.getBewit(credentials, '/resource/1?b=1&a=2', 'example.com', 8080, duration, { ext: 'some-app-data' });
var uri = 'http://example.com:8000/resource/1?b=1&a=2' + '&bewit=' + bewit;
```


# Security Considerations

The greatest sources of security risks are usually found not in **Hawk** but in the policies and procedures surrounding its use.
Implementers are strongly encouraged to assess how this module addresses their security requirements. This section includes
an incomplete list of security considerations that must be reviewed and understood before deploying **Hawk** on the server.

### MAC Keys Transmission

**Hawk** does not provide any mechanism for obtaining or transmitting the set of shared credentials required. Any mechanism used
to obtain **Hawk** credentials must ensure that these transmissions are protected using transport-layer mechanisms such as TLS.

### Confidentiality of Requests

While **Hawk** provides a mechanism for verifying the integrity of HTTP requests, it provides no guarantee of request
confidentiality. Unless other precautions are taken, eavesdroppers will have full access to the request content. Servers should
carefully consider the types of data likely to be sent as part of such requests, and employ transport-layer security mechanisms
to protect sensitive resources.

### Spoofing by Counterfeit Servers

**Hawk** makes no attempt to verify the authenticity of the server. A hostile party could take advantage of this by intercepting
the client's requests and returning misleading or otherwise incorrect responses. Service providers should consider such attacks
when developing services using this protocol, and should require transport-layer security for any requests where the authenticity
of the resource server or of server responses is an issue.

### Plaintext Storage of Credentials

The **Hawk** key functions the same way passwords do in traditional authentication systems. In order to compute the request MAC,
the server must have access to the key in plaintext form. This is in contrast, for example, to modern operating systems, which
store only a one-way hash of user credentials.

If an attacker were to gain access to these keys - or worse, to the server's database of all such keys - he or she would be able
to perform any action on behalf of any resource owner. Accordingly, it is critical that servers protect these keys from unauthorized
access.

### Entropy of Keys

Unless a transport-layer security protocol is used, eavesdroppers will have full access to authenticated requests and request
MAC values, and will thus be able to mount offline brute-force attacks to recover the key used. Servers should be careful to
assign keys which are long enough, and random enough, to resist such attacks for at least the length of time that the **Hawk**
credentials are valid.

For example, if the credentials are valid for two weeks, servers should ensure that it is not possible to mount a brute force
attack that recovers the key in less than two weeks. Of course, servers are urged to err on the side of caution, and use the
longest key reasonable.

It is equally important that the pseudo-random number generator (PRNG) used to generate these keys be of sufficiently high
quality. Many PRNG implementations generate number sequences that may appear to be random, but which nevertheless exhibit
patterns or other weaknesses which make cryptanalysis or brute force attacks easier. Implementers should be careful to use
cryptographically secure PRNGs to avoid these problems.

### Coverage Limitations

The request MAC only covers the HTTP `Host` header and does not cover any other headers which can often affect how the request
body is interpreted by the server (i.e. Content-Type). If the server behavior is influenced by the presence or value of such headers,
an attacker can manipulate the request header without being detected. Implementers should use the `ext` feature to pass
application-specific information via the Authorization header which is protected by the request MAC.

### Future Time Manipulation

The protocol relies on a clock sync between the client and server. To accomplish this, the server informs the client of its
current time as well as identifies the NTP server used (the client can opt to use either one to calculate the offset used for
further interactions with the server).

If an attacker is able to manipulate this information and cause the client to use an incorrect time, it would be able to cause
the client to generate authenticated requests using time in the future. Such requests will fail when sent by the client, and will
not likely leave a trace on the server (given the common implementation of nonce, if at all enforced). The attacker will then
be able to replay the request at the correct time without detection.

The client must only use the time information provided by the server if it is sent over a TLS connection and the server identity
has been verified.

### Client Clock Poisoning

When receiving a request with a bad timestamp, the server provides the client with its current time as well as the name of an
NTP server which can be used as a time reference. The client must never use the time received from the server to adjust its own
clock, and must only use it to calculate an offset for communicating with that particular server.

In addition, the client must not draw any correlation between the server's time provided via the 'ts' attribute and the current
time at the NTP server indicated via the 'ntp' variable. In other works, the client must not make any conclusion about the NTP
server indicated based on the server response.

### Bewit Limitations

Special care must be taken when issuing bewit credentials to third parties. Bewit credentials are valid until expiration and cannot
be revoked or limited without using other means. Whatever resource they grant access to will be completely exposed to anyone with
access to the bewit credentials which act as bearer credentials for that particular resource. While bewit usage is limited to GET
requests only and therefore cannot be used to perform transactions or change server state, it can still be used to expose private
and sensitive information.


# Frequently Asked Questions

### Where is the protocol specification?

If you are looking for some prose explaining how all this works, there isn't any. **Hawk** is being developed as an open source
project instead of a standard. In other words, the [code](/hueniverse/hawk/tree/master/lib) is the specification. Not sure about
something? Open an issue!

### Is it done?

No but it's getting close. Until this module reaches version 1.0.0 it is considered experimental and is likely to change. This also
means your feedback and contribution are very welcome. Feel free to open issues with questions and suggestions.

### Does **Hawk** have anything to do with OAuth?

Short answer: no.

**Hawk** was originally proposed as the OAuth MAC Token specification. However, the OAuth working group in its consistent
incompetence failed to produce a final, usable solution to address one of the most popular use cases of OAuth 1.0 - using it
to authenticate simple client-server transactions (i.e. two-legged).

**Hawk** provides a simple HTTP authentication scheme for making client-server requests. It does not address the OAuth use case
of delegating access to a third party. If you are looking for an OAuth alternative, check out [Oz](/hueniverse/oz).

### Where can I find **Hawk** implementations in other languages?

**Hawk** is only officially implemented in JavaScript as a node.js module. However, others are actively porting it to other
platforms. There is already a [PHP](https://github.com/alexbilbie/PHP-Hawk),
[.NET](https://github.com/pcibraro/hawknet), and [JAVA](https://github.com/wealdtech/hawk) libraries available. The full list
is maintained [here](https://github.com/hueniverse/hawk/issues?labels=port). Please add an issue is you are working on another
port. A cross-platform test-suite is in the works.

### Why isn't the algorithm part of the challenge or dynamically negotiated?

The algorithm used is closely related to the key issued as different algorithms require different key sizes (and other
requirements). While some keys can be used for multiple algorithm, the protocol is designed to closely bind the key and algorithm
 together as part of the issued credentials.

### Why is Host the only header covered by the request MAC?

It is really hard to include other headers. Headers can be changed by proxies and other intermediaries and there is no
well-established way to normalize them. The only straight-forward solution is to include the headers in some blob (say,
bas64 encoded JSON) and include that with the request, an approach taken by JWT and other such formats. However, that
design violates the HTTP header boundaries, repeats information, and introduces other security issues because firewalls
will not be aware of these "hidden" headers. In addition, any information repeated must be compared to the duplicated
information in the header and therefore only moves the problem elsewhere.

### Why not just use HTTP Digest?

Digest requires pre-negotiation to establish a nonce. This means you can't just make a request - you must first send
a protocol handshake to the server. This pattern has become unacceptable for most web services, especially mobile
where extra round-trip are costly. While Hawk includes support for sending a challenge when a request lacks
authentication, it does not require it.

### Why bother with all this nonce and timestamp business?

**Hawk** is an attempt to find a reasonable, practical compromise between security and usability. OAuth 1.0 got timestamp
and nonces half the way right but failed when it came to scalability and consistent developer experience. **Hawk** addresses
it by requiring the client to sync its clock, but provides it with tools to accomplish it.

In general, replay protection is a matter of application-specific threat model. It is less of an issue on a TLS-protected
system where the clients are implemented using best practices and are under the control of the server. Instead of dropping
replay protection, **Hawk** offers a required time window and an optional nonce verification. Together, it provides developers
with the ability to decide how to enforce their security policy without impacting the client's implementation.

### Is the NTP attribute really necessary?

It's a good investment for the future. While clients can use the server time to calculate clock skew, large scale deployment
of clients talking to many servers is going to make this very expensive. Such clients will need to maintain a large data set
of clock offsets, and keep updating it. Instead, the NTP information allows them to keep track of much fewer clocks, especially
when using the default 'pool.ntp.org' service.


# Acknowledgements

**Hawk** is a derivative work of the [HTTP MAC Authentication Scheme](http://tools.ietf.org/html/draft-hammer-oauth-v2-mac-token-05) proposal
co-authored by Ben Adida, Adam Barth, and Eran Hammer, which in turn was based on the OAuth 1.0 community specification.

Special thanks to Ben Laurie for his always insightful feedback and advice.

The **Hawk** logo was created by [Chris Carrasco](http://chriscarrasco.com).
