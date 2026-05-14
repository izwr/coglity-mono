type Handler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

type Route = {
  method: string;
  path: string;
  handler: Handler;
};

const BILLING_SECRET = process.env.BILLING_SECRET ?? "";

function requireSecret(req: Request): Response | null {
  if (!BILLING_SECRET) {
    return Response.json({ error: "BILLING_SECRET not configured" }, { status: 500 });
  }
  const provided = req.headers.get("x-billing-secret") ?? "";
  if (provided !== BILLING_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function matchPath(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = pathParts[i];
    } else if (pp !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler, auth = true) {
    const wrappedHandler: Handler = auth
      ? async (req, params) => {
          const denied = requireSecret(req);
          if (denied) return denied;
          return handler(req, params);
        }
      : handler;
    this.routes.push({ method, path, handler: wrappedHandler });
  }

  get(path: string, handler: Handler, auth = true) {
    this.add("GET", path, handler, auth);
  }

  post(path: string, handler: Handler, auth = true) {
    this.add("POST", path, handler, auth);
  }

  put(path: string, handler: Handler, auth = true) {
    this.add("PUT", path, handler, auth);
  }

  handle = async (req: Request): Promise<Response> => {
    const method = req.method;
    const url = new URL(req.url);
    const pathname = url.pathname;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchPath(route.path, pathname);
      if (params !== null) {
        try {
          return await route.handler(req, params);
        } catch (err) {
          console.error("Unhandled route error:", err);
          return Response.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      }
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  };
}

export const router = new Router();
