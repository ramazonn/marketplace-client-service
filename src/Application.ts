import * as Helmet from 'koa-helmet';
import * as Logger from 'koa-logger';
import * as BodyParser from 'koa-bodyparser';
import * as Koa from 'koa';
import * as basicAuth from 'koa-basic-auth';

import { createServer, Server } from 'http';
import { Module } from '@ubaytools/core';
import Routes from './routes';
import { CorsMiddleware, ModernMiddleware, CorrelationMiddleware, MemoryDiagnosticsMiddleware } from './middlewares';
import { SwaggerRouter } from 'koa-swagger-decorator';

import { koaSwagger } from 'koa2-swagger-ui';
import * as fs from 'fs';
import * as path from 'path';

export class Application {
  protected _mongoUrl: string;
  protected _host: string;
  protected _port: number;

  server = new Server();
  koa = new Koa();
  mongo = Module.Mongo();

  buildHost(host: string): Application {
    this._host = host;
    return this;
  }

  buildPort(port: number): Application {
    this._port = port;
    return this;
  }

  buildUri(mongoUrl: string): Application {
    this._mongoUrl = mongoUrl;
    return this;
  }

  buildSwagger(): Application {
    // Create a SwaggerRouter instance
    const swaggerRouter = new SwaggerRouter();

    // Configure SwaggerRouter
    swaggerRouter.swagger({
      title: 'Ubaytools API',
      description: 'API for ubaytools',
      version: '1.0.0',

      swaggerOptions: {
        securityDefinitions: {
          bearerAuth: {
            name: 'Authorization',
            in: 'header',
            type: 'apiKey',
            description: 'JWT Authorization header',
          },
        },
      },
    });

    const swaggerDir = process.cwd() + '/public';
    if (!fs.existsSync(swaggerDir)) {
      fs.mkdirSync(swaggerDir);
    }

    // Map controllers to SwaggerRouter
    swaggerRouter.mapDir(__dirname);
    swaggerRouter.dumpSwaggerJson({ filename: 'swagger.json', dir: swaggerDir });

    return this;
  }

  startServer(): Application {
    this.koa.proxy = true;
    this.koa.use(Logger());
    this.koa.use(CorrelationMiddleware);
    this.koa.use(MemoryDiagnosticsMiddleware);
    this.koa.use(CorsMiddleware);
    this.koa.use(ModernMiddleware);
    this.koa.use(BodyParser());

    // Serve Swagger UI at /docs
    // Combine basicAuth and koaSwagger for /docs route
    console.log('process.env.NODE_ENV', process.env.NODE_ENV);
    if (process.env.NODE_ENV === 'production') {
      
      this.koa.use(async (ctx, next) => {
        if (ctx.path.startsWith('/docs')) {
          try {
            await basicAuth({ name: process.env.SWAGGER_USERNAME, pass: process.env.SWAGGER_PASSWORD })(ctx, async () => {
              try {
                await koaSwagger({
                  routePrefix: '/docs', // Disable automatic routing
                  swaggerOptions: {
                    spec: require(path.join(process.cwd(), 'public/swagger.json')),
                  },
                })(ctx, next);
              } catch (e) {
                console.error(e);
              }
            });
          } catch (error) {
            console.error(error);
          }
        } else {
          await next();
        }
      });
    } else {
      this.koa.use(
        koaSwagger({
          routePrefix: '/docs', // Host Swagger UI at /docs
          swaggerOptions: {
            spec: require(path.join(process.cwd(), 'public/swagger.json')),
          },
        }),
      );
    }

    this.koa.use(Routes.routes());
    this.koa.use(Routes.allowedMethods());

    this.server = createServer(this.koa.callback());
    this.server.listen(this._port, this._host);
    console.log(`Server listening: ${this._host}:${this._port}`);
    return this;
  }

  connectMongo(): Application {
    this.mongo.buildUri(this._mongoUrl).buildOptions({ autoIndex: false, readPreference: 'secondaryPreferred' }).connect().then();
    return this;
  }

  // connectRabbitMQ() {
  //   const amqp = Module.Amqp();
  //   amqp.connect().then();
  // }
}
