FROM node:24.22.0-trixie-slim AS node

FROM cypress/included:16.2.1@sha256:f1f257405a482bdf95358cd30202d9c3ac69f907d5e96342ae377b8111ff7a15

COPY --from=node /usr/local/ /usr/local/

WORKDIR /workspace

COPY backend/ backend/
COPY mobile/ mobile/
COPY simulated-client/ simulated-client/
COPY e2e/ e2e/

RUN node -e "if (process.versions.node.split('.')[0] !== '24') throw new Error('Use uma imagem Cypress com Node 24')"
RUN npm --prefix backend ci \
    && npm --prefix mobile ci \
    && npm --prefix simulated-client ci \
    && CYPRESS_INSTALL_BINARY=0 npm --prefix e2e ci

ENTRYPOINT ["node", "e2e/run.mjs"]
