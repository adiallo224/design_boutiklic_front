# Vitrine publique multi-sites (Next.js, serveur autonome). Contexte de build = RACINE du dépôt (la vitrine lit packages/shared en source):
#   docker build -f boutiklic-storefront/Dockerfile -t boutiklic-storefront .
FROM node:20-alpine AS build
WORKDIR /repo
COPY packages/shared ./packages/shared
COPY boutiklic-storefront ./boutiklic-storefront
WORKDIR /repo/boutiklic-storefront
RUN npm ci
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/boutiklic-storefront/.next/standalone ./
COPY --from=build /repo/boutiklic-storefront/.next/static ./boutiklic-storefront/.next/static
USER node
EXPOSE 3000
# GATEWAY_URL: adresse interne du gateway (ex. http://gateway:8080). Ne JAMAIS définir STOREFRONT_DEV_HOST en production.
CMD ["node", "boutiklic-storefront/server.js"]
