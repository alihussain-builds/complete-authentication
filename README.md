# Complete Authentication

A Node.js and Express API for account registration, email OTP verification, password-based login, JWT access tokens, and refresh-token-backed sessions stored in MongoDB.

> **Implementation note:** This README describes the current source code. It does not imply that the implementation has been security-audited or is production-ready.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Authentication Architecture and Request Flow](#authentication-architecture-and-request-flow)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Authentication and Session Lifecycle](#authentication-and-session-lifecycle)
- [Password Hashing and Verification](#password-hashing-and-verification)
- [JWT and Refresh Token Handling](#jwt-and-refresh-token-handling)
- [Cookie Configuration](#cookie-configuration)
- [Email and OTP Verification](#email-and-otp-verification)
- [Error Handling and Validation](#error-handling-and-validation)
- [Security Considerations and Known Limitations](#security-considerations-and-known-limitations)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [License](#license)

## Overview

The service mounts authentication endpoints at `/api/auth`. It stores users, one-time password (OTP) records, and login sessions in MongoDB through Mongoose. New accounts are initially unverified. After OTP verification, users can log in to receive a short-lived access token in the response body and a refresh token in an HTTP-only cookie.

The API currently has no documented health-check or root endpoint.

## Features

- Account registration with username, email, and password fields.
- Email verification using a six-digit OTP.
- Login restricted to users whose email has been verified.
- JWT access tokens and rotating refresh tokens.
- Per-login session records with a hashed refresh token, IP address, user agent, and revocation flag.
- Logout of the current refresh-token session or revocation of all of a user's sessions.
- Retrieval of the current user's username and email using a bearer access token.

## Technology Stack

| Technology | Use in this project |
| --- | --- |
| Node.js (ES modules) | JavaScript runtime and module format |
| Express 5 | HTTP server and routing |
| MongoDB and Mongoose | Persistence and models |
| `jsonwebtoken` | JWT signing and verification |
| Node.js `crypto` | SHA-256 hashing of passwords, OTP values, and refresh tokens |
| Nodemailer | Gmail OAuth2 email transport |
| `dotenv` | Loading environment variables |
| `cookie-parser` | Reading refresh-token cookies |
| Morgan | Development HTTP request logging |
| Nodemon | Development server reloading |

Dependency versions are listed in `package.json`.

## Project Structure

```text
.
├── server.js
├── package.json
└── src/
    ├── app.js
    ├── config/
    │   ├── config.js
    │   └── database.js
    ├── controllers/
    │   └── auth.controller.js
    ├── models/
    │   ├── otp.model.js
    │   ├── session.model.js
    │   └── user.model.js
    ├── routes/
    │   └── auth.routes.js
    ├── services/
    │   └── email.service.js
    └── utils/
        └── utils.js
```

- `server.js` starts the MongoDB connection and listens on port `3000`.
- `src/app.js` configures JSON request parsing, Morgan logging, cookie parsing, and the `/api/auth` router.
- `src/config/config.js` loads and checks required environment variable names.
- `src/config/database.js` connects Mongoose to the configured MongoDB URI.
- `src/routes/auth.routes.js` maps HTTP methods and paths to authentication controllers.
- `src/controllers/auth.controller.js` implements registration, login, token refresh, user lookup, logout, and email verification.
- `src/models/user.model.js` defines the user schema.
- `src/models/session.model.js` defines session and refresh-token-hash storage.
- `src/models/otp.model.js` defines OTP record storage.
- `src/services/email.service.js` configures the Gmail OAuth2 Nodemailer transport and sends verification email.
- `src/utils/utils.js` generates OTP values and builds their HTML email content.

## Authentication Architecture and Request Flow

1. A client registers with `username`, `email`, and `password`.
2. The service hashes the password with SHA-256, creates an unverified user, hashes a generated OTP for storage, and attempts to send the OTP by email.
3. The client submits the email and OTP to the email-verification endpoint. A matching OTP record marks the corresponding user as verified and is then deleted.
4. A verified user logs in with email and password. The service creates a session record, returns a 15-minute access JWT in JSON, and sets a seven-day refresh JWT in the `refreshToken` cookie.
5. The client sends the access JWT as a bearer token to `/get-me`. When the access token expires, the client sends the refresh cookie to `/refresh-token`; the endpoint rotates the stored refresh-token hash and replaces the cookie.
6. Logout revokes the session matching the supplied refresh token. Logout-all revokes all non-revoked sessions for the user represented by the refresh token.

Access-token verification and refresh-token verification are performed in their respective controllers; the project does not define a separate authentication middleware.

## Prerequisites

- Node.js and npm, with a Node.js version that supports ES modules.
- A reachable MongoDB deployment and a connection URI.
- Gmail OAuth2 configuration for the Nodemailer transport.

The repository does not specify a minimum Node.js version or include a database setup script.

## Installation and Setup

1. Clone the repository and change to the project directory.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a local `.env` file in the project root and provide the variables listed below. Do not commit credentials or tokens.
4. Start the application using the development script described in [Running the Application](#running-the-application).

The configuration module throws an error when a required variable is missing. The application listens on port `3000`, which is hard-coded in `server.js`.

## Environment Variables

Variable names below are read by `src/config/config.js`. Values are intentionally omitted.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection URI used by Mongoose. |
| `JWT_SECRET` | Secret used to sign and verify both access and refresh JWTs. |
| `GOOGLE_CLIENT_ID` | Gmail OAuth2 client ID used by Nodemailer. |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth2 client secret used by Nodemailer. |
| `GOOGLE_REFRESH_SECRET` | OAuth2 refresh token supplied to Nodemailer. |
| `GOOGLE_USER` | Gmail account used by the transport and as the sender address. |

Example local configuration shape (replace each placeholder locally; this is not a usable configuration):

```dotenv
MONGO_URI=<your-mongodb-connection-uri>
JWT_SECRET=<your-jwt-signing-secret>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
GOOGLE_REFRESH_SECRET=<your-google-oauth-refresh-token>
GOOGLE_USER=<your-gmail-address>
```

## Running the Application

The only application run script in `package.json` is:

```sh
npm run dev
```

This invokes Nodemon for `server.js`. The server uses port `3000`; there is no configurable port script or production start script in the package scripts.

## API Documentation

All endpoints are mounted under `/api/auth`. JSON request bodies are parsed by Express. Cookie-based endpoints require the `refreshToken` cookie unless otherwise stated.

### `POST /api/auth/register`

Registers an unverified user, stores a hashed OTP record, and attempts to send a verification email.

- **Authentication:** None.
- **Request body:**

  ```json
  {
    "username": "alex",
    "email": "alex@example.com",
    "password": "example-password"
  }
  ```

- **Success — `201 Created`:**

  ```json
  {
    "message": "User registered successfully",
    "user": {
      "username": "alex",
      "email": "alex@example.com",
      "verified": false
    }
  }
  ```

- **Conflict — `409 Conflict`:** returned when the username or email matches an existing user.

  ```json
  {
    "message": "Username or email is alredy exists"
  }
  ```

The exact conflict message, including its spelling, is reproduced from the controller.

### `POST /api/auth/login`

Authenticates a verified user, creates a session, returns an access token, and sets the refresh-token cookie.

- **Authentication:** None.
- **Request body:**

  ```json
  {
    "email": "alex@example.com",
    "password": "example-password"
  }
  ```

- **Success — `200 OK`:**

  ```json
  {
    "message": "Logged in successfully",
    "user": {
      "username": "alex",
      "email": "alex@example.com"
    },
    "accessToken": "<access-jwt>"
  }
  ```

  The response also sets the `refreshToken` cookie described in [Cookie Configuration](#cookie-configuration).

- **Unauthorized — `401 Unauthorized`:** unknown email or incorrect password:

  ```json
  {
    "message": "Invalid email or password"
  }
  ```

- **Unauthorized — `401 Unauthorized`:** account email is not verified:

  ```json
  {
    "message": "Email not verified"
  }
  ```

### `GET /api/auth/get-me`

Returns the username and email associated with a valid access token.

- **Authentication:** `Authorization: Bearer <access-jwt>`.
- **Request body, parameters, cookies:** None required.
- **Example request:**

  ```sh
  curl http://localhost:3000/api/auth/get-me \
    -H "Authorization: Bearer <access-jwt>"
  ```

- **Success — `200 OK`:**

  ```json
  {
    "message": "user fetched successfully",
    "user": {
      "username": "alex",
      "email": "alex@example.com"
    }
  }
  ```

- **Unauthorized — `401 Unauthorized`:** no token is present after splitting the authorization header:

  ```json
  {
    "message": "token not found"
  }
  ```

Invalid or expired JWTs are passed to `jsonwebtoken.verify`; the controller does not map those exceptions to a documented JSON response.

### `GET /api/auth/refresh-token`

Verifies the refresh cookie, rotates the session's stored refresh-token hash, sets a replacement cookie, and returns a new access token.

- **Authentication:** Valid `refreshToken` cookie.
- **Request body and parameters:** None.
- **Example request:**

  ```sh
  curl http://localhost:3000/api/auth/refresh-token \
    -b "refreshToken=<refresh-jwt>" \
    -c cookies.txt
  ```

- **Success — `200 OK`:**

  ```json
  {
    "message": "Access token refreshed successfully",
    "accessToken": "<new-access-jwt>"
  }
  ```

  The response sets a new `refreshToken` cookie.

- **Unauthorized — `401 Unauthorized`:** cookie is absent:

  ```json
  {
    "message": "refresh token not found"
  }
  ```

- **Unauthorized — `401 Unauthorized`:** a verified token does not match an active stored refresh-token hash:

  ```json
  {
    "message": "Invalid refresh token"
  }
  ```

Invalid or expired JWT verification errors are not caught and converted to a documented API response.

### `GET /api/auth/logout`

Revokes the session matching the supplied refresh token and clears the cookie.

- **Authentication:** `refreshToken` cookie.
- **Request body and parameters:** None.
- **Example request:**

  ```sh
  curl http://localhost:3000/api/auth/logout \
    -b "refreshToken=<refresh-jwt>" \
    -c cookies.txt
  ```

- **Success — `200 OK`:**

  ```json
  {
    "message": "Logout successfully"
  }
  ```

- **Bad request — `400 Bad Request`:** cookie is absent:

  ```json
  {
    "message": "Refresh token not found"
  }
  ```

- **Bad request — `400 Bad Request`:** no active session matches the cookie hash:

  ```json
  {
    "message": "Invalid refresh token"
  }
  ```

### `GET /api/auth/logout-all`

Revokes all non-revoked sessions belonging to the user ID in the supplied refresh JWT and clears the cookie.

- **Authentication:** A `refreshToken` cookie with a valid JWT. The controller does not require that its corresponding session be active.
- **Request body and parameters:** None.
- **Example request:**

  ```sh
  curl http://localhost:3000/api/auth/logout-all \
    -b "refreshToken=<refresh-jwt>" \
    -c cookies.txt
  ```

- **Success — `200 OK`:**

  ```json
  {
    "message": "Logged out from all devices successfully"
  }
  ```

- **Bad request — `400 Bad Request`:** cookie is absent:

  ```json
  {
    "message": "Refresh token not found"
  }
  ```

Invalid or expired JWT verification errors are not mapped to a documented response by the controller.

### `GET /api/auth/verify-email`

Looks up an OTP record by email and the SHA-256 hash of the submitted OTP, marks that record's user verified, then deletes OTP records for that user.

- **Authentication:** None.
- **Request body:** Although this route is `GET`, the controller reads JSON body fields `email` and `otp`.
- **Example request:**

  ```sh
  curl -X GET http://localhost:3000/api/auth/verify-email \
    -H "Content-Type: application/json" \
    -d '{"email":"alex@example.com","otp":"123456"}'
  ```

- **Success — `200 OK`:**

  ```json
  {
    "message": "Email verified successfully",
    "user": {
      "username": "alex",
      "email": "alex@example.com",
      "verified": true
    }
  }
  ```

- **Bad request — `400 Bad Request`:** no matching email and OTP record:

  ```json
  {
    "message": "Invalid OTP"
  }
  ```

The OTP value in the example is illustrative only. The source does not define an OTP expiration period.

## Authentication and Session Lifecycle

- A successful login creates one session document containing the user reference, SHA-256 hash of the refresh JWT, request IP, user-agent, and a `revoked` flag.
- Refreshing requires a valid JWT and a matching non-revoked session hash. The endpoint replaces the stored hash with the hash of a newly signed refresh token.
- Logout marks the matching session revoked. Logout-all marks every currently non-revoked session for the refresh token's user ID revoked.
- Access tokens include the user ID and session ID and expire after 15 minutes. `/get-me` verifies the JWT and loads the user, but does not check session revocation.
- Session and OTP schemas use Mongoose timestamps. The OTP model does not define a TTL index.

## Password Hashing and Verification

The controller hashes submitted passwords with Node.js SHA-256 and hexadecimal output during registration and login. The stored hash is compared directly with the newly calculated hash.

The implementation does not use a password-specific key derivation function or a per-user salt. See [Security Considerations and Known Limitations](#security-considerations-and-known-limitations).

## JWT and Refresh Token Handling

- Access JWT lifetime: **15 minutes**.
- Refresh JWT lifetime: **7 days**.
- Both token types are signed and verified using `JWT_SECRET`.
- The access JWT is returned in JSON. The refresh JWT is returned only as a cookie.
- The database stores SHA-256 hashes of refresh JWTs, not the token strings.
- Refreshing rotates the cookie token and persisted hash.

The source does not configure issuer, audience, or separate signing keys for access and refresh tokens.

## Cookie Configuration

The login and refresh endpoints set the cookie with:

| Attribute | Configured value |
| --- | --- |
| Name | `refreshToken` |
| `httpOnly` | `true` |
| `secure` | `true` |
| `sameSite` | `strict` |
| `maxAge` | Seven days |

No explicit cookie `domain` or `path` is set. Logout endpoints clear the cookie. Because the cookie is marked `secure`, browsers ordinarily do not send it over plain HTTP; use HTTPS in environments where browser cookie behavior is required.

## Email and OTP Verification

Registration generates a six-digit OTP, hashes it for database storage, and sends both plain-text and HTML email content through Nodemailer configured for Gmail OAuth2. The OAuth-related configuration names are listed in [Environment Variables](#environment-variables).

The verification route accepts `email` and `otp` in its request body, finds the matching hash, marks the linked user verified, and deletes OTP records for that user. The OTP model has timestamps, but no expiration policy, attempt limit, or cleanup TTL is implemented.

The email service catches and logs errors from `sendMail` rather than rethrowing them. Consequently, registration can return its success response even when sending the verification email fails. Transport verification errors are also logged.

## Error Handling and Validation

The controllers explicitly return JSON errors for the cases listed in the endpoint documentation. The application does not configure a shared error-handling middleware or a request-validation middleware. JWT verification, database errors, and other unexpected exceptions are not translated by these controllers into a consistent API error format.

Request bodies are read directly from `req.body`; there is no explicit schema validation for field presence, format, length, or password policy in the route/controller code. Mongoose schema validation and unique indexes may apply to persisted data, but are not a substitute for defined request validation.

## Security Considerations and Known Limitations

This section records observable implementation limits; it is not a security audit.

- Passwords are hashed with unsalted SHA-256, which is not a password-specific key derivation scheme.
- OTP generation uses `Math.random()` and OTP records have no expiry, attempt throttling, or rate limiting.
- Registration reports success even if Nodemailer fails to send the verification message.
- JWT verification exceptions and unexpected database/runtime errors have no project-defined, consistent error response.
- `/get-me` verifies the access token but does not check whether its session has been revoked. A logged-out access token may remain usable until expiry.
- The refresh and logout-all controllers verify the refresh JWT, but logout-all does not confirm an active session record before revoking the user's sessions.
- Both JWT types share one signing secret; issuer, audience, and token-type claims are not configured.
- There is no visible rate limiting, CORS policy, CSRF-specific defense, or request validation middleware in the application setup.
- The refresh cookie is `Secure`; local browser-based testing over plain HTTP may not send it.
- Environment configuration includes Gmail OAuth credentials, and all listed variables are required at module load time, even when only testing non-email routes.

## Testing

No automated tests are defined in the project. The `test` script in `package.json` is a placeholder that prints `Error: no test specified` and exits with a failure status; `npm test` therefore does not run a test suite.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Startup reports a required variable is missing | Ensure all six names in [Environment Variables](#environment-variables) are present in the local environment configuration. |
| MongoDB connection fails | Check MongoDB availability and the locally configured `MONGO_URI`. |
| Verification email is not received | Check Gmail OAuth2 configuration and the application logs. The mail service logs send failures, while registration can still return success. |
| Refresh cookie is not sent by a browser | Confirm HTTPS is being used; the cookie is configured with `secure: true`. |
| `npm test` exits with an error | This is expected from the placeholder script; no test suite is configured. |
| Server is listening on an unexpected port | The port is currently hard-coded to `3000` in `server.js`. |

## Future Improvements

The following are suggestions, not implemented features:

- Replace raw SHA-256 password hashing with a salted, password-specific KDF and rehash existing credentials during migration.
- Use a cryptographically secure OTP generator and add expiration, attempt limits, and resend throttling.
- Add request validation, centralized error responses, and automated tests.
- Ensure refresh/logout operations validate and consistently revoke the relevant sessions; consider checking session state for access-token requests.
- Separate access/refresh signing keys or claims and configure issuer and audience validation.
- Add rate limiting and deploy-specific transport protections, and make the listener port configurable.
- Make email delivery failures explicit to the registration flow and use configurable sender identity.

## License

`package.json` declares the project license as **ISC**.
