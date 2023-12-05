# ICAC Scoresheet

ICAC Scoresheet is envisioned to be a mobile-first fullstack web app to facilitate scoring in archery competitions. The app will be specifically designed to automate tedious and error-prone tasks so that archers can spend more time shooting instead of doing mental math. In particular, the following features will be supported:
- computing end totals
- submitting end totals
- score confirmation amongst archers shooting on the same boss
- score amendments through a line judge

A user flow diagram summarizing the key features to be developed for the first prototype can be accessed [here](https://lucid.app/lucidchart/53149233-88d6-4a3e-afb4-5ee23f86edc6/edit?viewport_loc=4384%2C-1008%2C8388%2C4563%2C0_0&invitationId=inv_f0088e1f-dea4-40ec-9b89-0c3331b7934c) on Lucidcharts.


## Project Structure

![ICAC Scoresheet User Flowchart - Page 1 (2)](https://github.com/Levurmion/ICAC-Scoresheet/assets/122384242/baca3e81-dd5e-4f0d-8d3a-d05c3dd2ebe6)

The project will be composed of 6 main services.

<table>
  <thead>
    <th>service</th>
    <th>technology</th>
    <th>hosting service</th>
  </thead>
  <tbody>
    <tr>
      <td>primary database</td>
      <td>PostgreSQL</td>
      <td>Supabase</td>
    </tr>
    <tr>
      <td>cache</td>
      <td>Redis</td>
      <td>AWS Redis Elasticache</td>
    </tr>
    <tr>
      <td>backend</td>
      <td>Express (NodeJS)</td>
      <td>AWS ECS on Fargate/EC2</td>
    </tr>
    <tr>
      <td>frontend</td>
      <td>NextJS (React)</td>
      <td>AWS ECS on Fargate/EC2</td>
    </tr>
    <tr>
      <td>match server</td>
      <td>Socket.IO (NodeJS)</td>
      <td>AWS ECS on Fargate/EC2</td>
    </tr>
    <tr>
      <td>reverse proxy</td>
      <td>NGINX</td>
      <td>AWS EKS (Kubernetes)</td>
    </tr>
  </tbody>
</table>

> The exact host/technologies used for each service are subject to change according to any challenges encountered throughout the course of development.

### Supabase
Supabase is a fully managed *Backend-as-a-Service* (BaaS) that provides a suite of Javascript SDKs and ORM libraries to remotely interface with an underlying PostgreSQL instance. It was made as an open-source alternative to Google's Firebase which in contrast, uses a proprietary NoSQL database. Like Firebase, Supabase comes packaged with many ubiquitous backend services such as authentication/authorization and row level security (RLS) to alleviate the labour overhead associated with configuring these features manually. In the context of this project, Supabase is going to serve primarily as an authentication service. While the platform provides SDKs enabling direct integration with NextJS, all backend logic will remain in separate Express apps consumable from the client through REST APIs. This maintains a clear separation of concerns between contributors and encapsulation of various services into distinct containerized applications for future scalability.

### Redis
Redis is an in-memory key-value database that provides *sub-ms* read-write latency typically crucial for enabling great UX in realtime applications. In the context of this project, Redis will serve as the primary database for all operations demanding realtime responses (for example, running live matches). Redis will be the primary source of truth for live game state as well as other supporting metadata like existing match reservations. Write operations to the primary database (Supabase PostgreSQL) will occur only **once** per match - that is after it has been completed with all arrows scored and verified.

### NextJS
NextJS is a full-featured React meta-framework providing many **server-side rendering** (SSR) capabilities to React applications. In essence, it pre-renders React components in the server to ensure that clients can display some static assets on page load instead of waiting for client-side React code to construct the application from scratch. This has several main benefits:
- **better UX** as instead of navigating to an initially blank page, users are initially greeted with static pre-rendered HTML
- **faster page loads** due to smaller client-side Javascript bundles as only pieces of the React library enabling client-side interactivity will be shipped to the browser
- **integration with modern build tools and CSS pre-processors** as NextJS integrates Tailwind, CSS modules, and webpack with almost zero developer configuration required

There are many more features of NextJS that make it an attractive solution for large-scale commercial systems. You can read more about this by going through the NextJS tutorial. However, as this project will require many realtime functionalities, things like **static site generation** (SSG) would mostly be irrelevant for the purposes of this application.

### Socket.IO
Socket.IO is a cross-platform **Websocket/HTTP long-polling** library that provides many important features typically required by realtime web applications. It is important to note that Socket.IO **is not** a Websocket implementation. It uses Websockets as one of the protocols for bidirectional client-server communication but can also default to HTTP long-polling under certain conditions such as browser incompatibility or reverse proxies misconfigurations. As such, the server-side Socket.IO server can only connect to its corresponding client-side Socket.IO instance and vice versa. Socket.IO will not accept connections from other Websocket libraries. [Read more about Socket.IO.](https://socket.io/)

### NGINX
NGINX is a webserver that has built-in load balancing and reverse proxy capabilities. For development, this project uses NGINX as a reverse proxy to serve all requests/responses to and from our backend services under a single domain. In production, it feels appropriate to build a Kubernetes cluster for high service availability considering that system failures mid-competitions cannot be tolerated. Serving the application under a single domain provides the following benefits:
- **A single TLS/SSL termination point** as NGINX can convert all outgoing traffic from our backend services into HTTPS. This means we only need one SSL certificate to enable HTTPS for our entire application, served by the NGINX webserver. Internally, all communication between services can safely occur through HTTP within a firewall.
- **No need to configure cross-domain cookies** for cross-service authentication. Since browsers tend to enforce strict single-domain policies for delivering cookies on HTTP/HTTPS requests, serving our entire application under a single domain circumvents having to configure TLS/SSL for individual services to enable cookies to be shared between different domains.
- **Future extensibility for load balancing** as in addition to being a reverse proxy, NGINX can "round-robin" requests to a pool of server instances to facilitate horizontal scaling.

## Setting Up A Local Dev Environment

To start contributing, please create a new branch with the following convention:

`[CATEGORY]-[NAME]-[MONTH]-[DAY]-[YEAR]`

**CATEGORIES**
<table>
  <thead>
    <th>category</th>
    <th>definition</th>
  </thead>
  <tbody>
    <tr>
      <td>hotfix</td>
      <td>for quickly fixing critical issues, usually with a temporary solution</td>
    </tr>
    <tr>
      <td>bugfix</td>
      <td>for fixing a bug with a long-term solution</td>
    </tr>
    <tr>
      <td>feature</td>
      <td>for adding, removing or modifying a feature</td>
    </tr>
    <tr>
      <td>exp</td>
      <td>for experimenting something which is not an issue</td>
    </tr>
  </tbody>
</table>

For example, if you are trying to build a new feature on the 20th of April, 2023, the branch name will be:

`feature-John-4-20-2023`

Next, install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on your computer. Make sure this is running before starting the dev server. Read more about **application containerization** and Docker in this [tutorial](https://docs.docker.com/get-started/).

Pull the branch into your local machine and start the dev server using the command:

```
docker-compose up -d
```

from the root of the project (where you can find the `docker-compose.yaml` file). The `-d` switch will run the containers in *detached mode* (in the background). The dev servers are configured for hot-reloading so simply make changes to the source files and they should be reflected on the application within a few seconds.

To stop the dev servers, use the command:

```
docker-compose down
```

and this will terminate all the containers but persist their images.


## Connecting to the Dev Servers

This repository contains the frontend, backend, and cache services - all of which are run on separate containers. `docker-compose up -d` spins up all these containers for you and forwards ports from the services (running inside a container) to process ports on your local machine. The compose file has configured the services to run on ports:

<table>
  <thead>
    <th>service</th>
    <th>port</th>
  </thead>
  <tbody>
    <tr>
      <td>Redis</td>
      <td>6379</td>
    </tr>
    <tr>
      <td>backend</td>
      <td>3001</td>
    </tr>
    <tr>
      <td>match server</td>
      <td>3030</td>
    </tr>  
    <tr>
      <td>frontend</td>
      <td>3000</td>
    </tr>
  </tbody>
</table>

However, only use these ports for debugging purposes. For development, connect to `localhost:8001`. Both backend and frontend services have been configured to be reverse proxied by NGINX running in a separate container. NGINX will serve the frontend pages through the root `/` path while backend APIs are accessible through `/api/` path. This configuration will save us a lot of headache from having to deal with cross-domain authentication as instead of the frontend and backend being served from `localhost:3000` and `localhost:3001` respectively, they will be served instead from `localhost:8001/` and `localhost:8001/api/`.

Therefore, all client-side API calls should be prefixed with the `/api/` path so that NGINX can proxy the request to the backend service.

## Creating Pull Requests

Once finished, remember to create a pull request with a descriptive message describing what it is you worked on. Include a README to document the work. For example, if you built a React component, give a couple words on:
- The main features of the component
- How the interface works
- Key limitations
- Proposed future extensions (if any)
- Preferrably an example





















