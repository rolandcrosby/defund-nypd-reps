# Defund the NYPD

Small [web app](https://defund-nypd-reps.glitch.me) that allows NYC residents to identify their city council members and look up their positions on defunding the NYPD.

## Project Layout/Architecture

- `server.js` is an Express app that serves three kinds of requests:
  - static files (in the `/public` and `/views` directories)
  - councilmember lookup requests by address (at the `/geoclient-proxy` endpoint)
  - councilmember position and information requests (at the `/sheet` endpoint)
- `get-data.js` fetches information about councilmembers from the [NewYorkCityCouncil/districts](https://github.com/NewYorkCityCouncil/districts) repository and the [Defund the NYPD collaborative spreadsheet](https://docs.google.com/spreadsheets/d/18pWRSu58DpENABkYUJlZw1ltCPZft7KJc6lFaOZK8-s/view)
- `public/script.js` contains all the client-side JavaScript. It's a single-component Vue app that fetches data from the above-mentioned endpoints.
- `views/index.html` is the Vue template. It's always rendered client-side but could probably be done on the server at some point.