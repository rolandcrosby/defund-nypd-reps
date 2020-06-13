const express = require("express");
const fetch = require('node-fetch');
const { getData, getSpreadsheetData } = require("./get-data");

const geoclient_app_id = process.env["GEOCLIENT_APP_ID"];
const geoclient_app_key = process.env["GEOCLIENT_APP_KEY"];
const geoclient_url = `https://api.cityofnewyork.us/geoclient/v1/address.json?app_id=${geoclient_app_id}&app_key=${geoclient_app_key}&`;

let spreadsheetData = null;
async function cacheSpreadsheetData() {
  if (spreadsheetData && new Date() - spreadsheetData.updatedAt < 30000) {
    return spreadsheetData.data;
  }
  spreadsheetData = { data: await getSpreadsheetData(), updatedAt: new Date() };
  return spreadsheetData.data;
}
// cacheSpreadsheetData();

async function geocodeAddress(q) {
  let queryString = `houseNumber=${encodeURIComponent(
    q.houseNumber
  )}&street=${encodeURIComponent(q.street)}&zip=${encodeURIComponent(q.zip)}`;
  const response = await fetch(geoclient_url + queryString);
  const data = await response.json();
  return data;
}

const app = express();

app.use(express.static("public"));

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/district/:district", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/sheet", async (request, response) => {
  try {
    response.json(await cacheSpreadsheetData());
  } catch (e) {
    response.status(500).json(e);
  }
});

app.get("/geoclient-proxy", async (request, response) => {
  try {
    const data = await geocodeAddress(request.query);
    response.status(200).json(data);
  } catch (e) {
    response.status(500).json(e);
  }
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
