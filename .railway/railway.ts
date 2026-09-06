import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Meet = github("scottylabs-labrador/Meet", {
    branch: "main",
    checkSuites: false,
  });

  const Postgres = postgres("Postgres");
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume");
  const _meetweb = service("@meet/web", {
    source: Meet,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/web/Dockerfile",
      watchPatterns: [
        "/apps/web/**",
        "/packages/common/**",
        "/packages/access-control/**",
        "/packages/db/**",
      ],
    },
    deploy: { sleepApplication: true },
    networking: { privateNetworkEndpoint: "meetweb" },
    env: {
      VITE_PUBLIC_POSTHOG_HOST: preserve(),
      VITE_PUBLIC_POSTHOG_KEY: preserve(),
      VITE_SERVER_URL: "${{@meet/server.SERVER_URL}}",
    },
  });
  const _meetserver = service("@meet/server", {
    source: Meet,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/server/Dockerfile",
      watchPatterns: [
        "/apps/server/**",
        "/packages/common/**",
        "/packages/access-control/**",
        "/packages/db/**",
      ],
    },
    deploy: {
      preDeployCommand: ["bunx drizzle-kit migrate --config=/app/apps/server/drizzle.config.ts"],
      sleepApplication: true,
    },
    networking: { privateNetworkEndpoint: "meetserver" },
    env: {
      ADMIN_GROUP: "meet-admins",
      ALLOWED_ORIGINS_REGEX: "https://meet.scottylabs.org",
      AUTH_CLIENT_ID: "meet-prod",
      AUTH_CLIENT_SECRET: preserve(),
      AUTH_ISSUER: "https://idp.scottylabs.org/realms/labrador",
      AUTH_JWKS_URI: "https://idp.scottylabs.org/realms/labrador/protocol/openid-connect/certs",
      BETTER_AUTH_URL: "https://meet.scottylabs.org",
      DATABASE_URL: "${{Postgres.DATABASE_URL}}",
      SENTRY_DSN: preserve(),
      SERVER_URL: "https://api.meet.scottylabs.org",
    },
  });

  return project("Meet", {
    resources: [Postgres, _meetweb, _meetserver, postgresVolume],
  });
});
