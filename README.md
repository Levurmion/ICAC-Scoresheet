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
      <td>Redis Cloud</td>
    </tr>
    <tr>
      <td>backend</td>
      <td>Express (NodeJS)</td>
      <td>AWS EC2</td>
    </tr>
    <tr>
      <td>frontend</td>
      <td>NextJS (React)</td>
      <td>AWS EC2</td>
    </tr>
    <tr>
      <td>match server</td>
      <td>Socket.IO (NodeJS)</td>
      <td>AWS EC2</td>
    </tr>
    <tr>
      <td>reverse proxy</td>
      <td>NGINX</td>
      <td>AWS EC2</td>
    </tr>
  </tbody>
</table>

> The exact host/technologies used for each service are subject to change according to any challenges encountered throughout the course of development.

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

However, only use these ports for debugging purposes. For development, connect to `localhost:80`. Both backend and frontend services have been configured to be reverse proxied by NGINX running in a separate container. NGINX will serve the frontend pages through the root `/` path while backend APIs are accessible through `/api/` path. This configuration will save us a lot of headache from having to deal with cross-domain authentication as instead of the frontend and backend being served from `localhost:3000` and `localhost:3001` respectively, they will be served instead from `localhost/` and `localhost/api/`.

Therefore, all client-side API calls should be prefixed with the `/api/` path so that NGINX can proxy the request to the backend service.




















