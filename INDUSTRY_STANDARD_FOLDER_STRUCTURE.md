# KnockNFix - Industry Standard Folder Structure (Proposed)

This is a target structure for a scalable Express + MongoDB application with EJS web pages and API routes.

## 1) Recommended Top-Level Layout

```text
KnockNFix/
  .github/
    workflows/
  docs/
    architecture/
    api/
    runbooks/
  scripts/
    migrate/
    seed/
    maintenance/

  src/
    app/
      app.js
      server.js
      constants/
      startup/
        env.js
        database.js
        session.js
        passport.js
        viewEngine.js
        staticAssets.js
      middlewares/
        auth.middleware.js
        roles.middleware.js
        validation.middleware.js
        error.middleware.js
        notFound.middleware.js
        requestContext.middleware.js
      routes/
        index.js
        web/
          auth.routes.js
          booking.routes.js
          dashboard.routes.js
          payment.routes.js
          profile.routes.js
          provider.routes.js
          services.routes.js
          complaints.routes.js
          feedback.routes.js
          chat.routes.js
          admin.routes.js
        api/
          index.js
          auth.routes.js
          booking.routes.js
          payment.routes.js
          dashboard.routes.js
      validations/
        auth.validation.js
        booking.validation.js
        payment.validation.js
        provider.validation.js
        common.validation.js
      serializers/
        booking.serializer.js
        user.serializer.js
      policies/
        booking.policy.js
        provider.policy.js
      docs/
        openapi.yaml

    modules/
      auth/
        auth.controller.js
        auth.service.js
        auth.repository.js
        auth.schema.js
        auth.mapper.js
      users/
        user.controller.js
        user.service.js
        user.repository.js
        user.schema.js
      providers/
        provider.controller.js
        provider.service.js
        provider.repository.js
        provider.schema.js
      services/
        service.controller.js
        service.service.js
        service.repository.js
        service.schema.js
      bookings/
        booking.controller.js
        booking.service.js
        booking.repository.js
        booking.schema.js
      payments/
        payment.controller.js
        payment.service.js
        payment.repository.js
        payment.schema.js
      complaints/
        complaint.controller.js
        complaint.service.js
        complaint.repository.js
        complaint.schema.js
      feedback/
        feedback.controller.js
        feedback.service.js
        feedback.repository.js
        feedback.schema.js
      admin/
        admin.controller.js
        admin.service.js
        admin.repository.js

    infrastructure/
      db/
        mongoose/
          plugins/
          indexes/
          transactions/
      cache/
        redis.client.js
      queue/
        bullmq.client.js
        jobs/
      storage/
        cloudinary.client.js
      payment/
        razorpay.client.js
      messaging/
        sms.client.js
        email.client.js
      logging/
        logger.js
        request.logger.js
      monitoring/
        health.js
        metrics.js

    shared/
      errors/
        AppError.js
        errorCodes.js
      utils/
        asyncHandler.js
        date.js
        distance.js
        mask.js
        sanitize.js
      config/
        env.schema.js
        index.js
      types/
      adapters/

    web/
      views/
        layouts/
        partials/
        pages/
        components/
      public/
        css/
        js/
        img/
        fonts/

    tests/
      unit/
      integration/
      e2e/
      fixtures/
      helpers/

  migrations/
  seeds/
  logs/
  tmp/

  .env
  .env.example
  .env.test
  Dockerfile
  docker-compose.yml
  package.json
  README.md
```

## 2) Architecture Rules (Industry Standard)

1. Route -> Controller -> Service -> Repository -> DB
2. Keep business logic in services, not in routes.
3. Keep DB queries in repositories.
4. Keep request validation in validations or middlewares.
5. Use shared error classes and centralized error handling.
6. Keep third-party SDK code in infrastructure clients only.
7. Separate web routes and api routes clearly.
8. Make modules feature-based (auth, booking, payment) instead of huge technical folders.

## 3) Naming Conventions

1. Use lowercase folder names.
2. Use suffixes consistently:
   - .routes.js
   - .controller.js
   - .service.js
   - .repository.js
   - .validation.js
   - .middleware.js
3. Keep one primary responsibility per file.

## 4) Suggested Migration Path For Your Current Project

1. Introduce src/ and move app bootstrap files first.
2. Keep current Controllers, routes, models as compatibility layer during migration.
3. Move one domain at a time into src/modules (auth -> bookings -> payments -> provider -> admin).
4. Move middleware into src/app/middlewares and validation files into src/app/validations.
5. Move external integrations from config and utils into src/infrastructure clients.
6. Move views and public into src/web while preserving express static + view paths.
7. Add tests by domain under src/tests.

## 5) Minimal First Step (No Breaking Changes)

If you want a low-risk start, create only these first:

```text
src/
  app/
    app.js
    server.js
    startup/
    middlewares/
    routes/
    validations/
  modules/
    auth/
    bookings/
    payments/
  infrastructure/
    payment/
    storage/
  shared/
    errors/
    utils/
  web/
    views/
    public/
```

Then gradually move old files into these folders.
