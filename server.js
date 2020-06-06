const express = require("express");
const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const app = express();

const spreadsheet_id = "18pWRSu58DpENABkYUJlZw1ltCPZft7KJc6lFaOZK8-s";
const google_api_key = process.env["GOOGLE_KEY"];
const geoclient_app_id = process.env["GEOCLIENT_APP_ID"];
const geoclient_app_key = process.env["GEOCLIENT_APP_KEY"];
const geoclient_url = `https://api.cityofnewyork.us/geoclient/v1/address.json?app_id=${geoclient_app_id}&app_key=${geoclient_app_key}&`;

let spreadsheetData = null;
async function getSpreadsheetData() {
  if (spreadsheetData && new Date() - spreadsheetData.updatedAt < 30000) {
    return spreadsheetData.data;
  }
  const doc = new GoogleSpreadsheet(spreadsheet_id);
  doc.useApiKey(google_api_key);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[1];
  await sheet.loadCells();
  const data = {};
  const headers = [];
  for (let c = 0; c < sheet.columnCount; c++) {
    headers.push(sheet.getCell(1, c).value);
  }
  for (let r = 2; r < sheet.rowCount; r++) {
    const district = sheet.getCell(r, 0).value;
    if (typeof district !== "number") {
      continue;
    }
    const name = sheet.getCell(r, 1).value;
    if (name === "Vacant") {
      data[district][name] = "Vacant";
      continue;
    }
    data[district] = { fields: [], phones: {}, statements: [] };
    for (let c = 0; c < sheet.columnCount; c++) {
      if (["district", "name", "borough"].includes(headers[c].toLowerCase())) {
        data[district][headers[c].toLowerCase()] = sheet.getCell(r, c).value;
      } else if (
        headers[c].toLowerCase().includes("phone") &&
        sheet.getCell(r, c).value
      ) {
        data[district].phones[headers[c]] = sheet
          .getCell(r, c)
          .value.toString()
          .trim()
          .split(/[ \n]+/g);
      } else if (
        headers[c].toLowerCase() == "email" &&
        sheet.getCell(r, c).value
      ) {
        data[district]["email"] = sheet
          .getCell(r, c)
          .value.toString()
          .split(/[ \n]+/g);
      } else if (
        headers[c].toLowerCase().includes("public statement") &&
        sheet.getCell(r, c).value &&
        sheet
          .getCell(r, c)
          .value.toString()
          .includes("http")
      ) {
        data[district].statements = sheet.getCell(r, c).value.toString().match(/\bhttps?[^\s]+/g);
      } else {
        data[district].fields.push([headers[c], sheet.getCell(r, c).value]);
      }
    }
  }
  spreadsheetData = { data: data, updatedAt: new Date() };
  return data;
}

async function geocodeAddress(q) {
  let queryString = `houseNumber=${encodeURIComponent(
    q.houseNumber
  )}&street=${encodeURIComponent(q.street)}&zip=${encodeURIComponent(q.zip)}`;
  const response = await fetch(geoclient_url + queryString);
  const data = await response.json();
  return data;
}

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/sheet", async (request, response) => {
  response.json(await getSpreadsheetData());
});

app.get("/geoclient-proxy", async (request, response) => {
  try {
    const data = await geocodeAddress(request.query);
    response.status(200).json(data);
  } catch (e) {
    response.status(500).json(e);
  }
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
