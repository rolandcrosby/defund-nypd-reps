const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const google_api_key = process.env["GOOGLE_KEY"];

const council_data_url =
  "https://raw.githubusercontent.com/NewYorkCityCouncil/districts/master/district_data/cm_master_file_no_geo.json";
const spreadsheet_id = "18pWRSu58DpENABkYUJlZw1ltCPZft7KJc6lFaOZK8-s";

async function getCouncilData() {
  const out = {};
  const councilData = await (await fetch(council_data_url)).json();
  councilData.forEach(d => {
    if (out.hasOwnProperty(d.district)) {
      console.error(`warning: duplicate district: ${d.district}`);
      return;
    }
    if (d.district === 37) {
      // skip Espinal since he resigned in January
      return;
    }
    const info = {
      full_name: d.council_member.PersonFullName,
      first_name: d.council_member.first_name,
      last_name: d.council_member.last_name,
      title: d.council_member.title,
      district: d.district,
      borough: null,
      party: d.council_member.party,
      photo_url: d.council_member.photo_url,
      gender: d.council_member.gender,
      social: { facebook_urls: [], instagram_handles: [], twitter_handles: [] },
      council_url: `https://council.nyc.gov/district-${d.district}/`,
      phones: [],
      emails: [],
      positions: {
        cut_nypd_budget: null,
        vote_against_status_quo_budget: null,
        nypd_cut_amount: null
      },
      public_statements: [],
      budget_negotiating_team: null,
      on_ballot: null,
      ballot_position: null,
      next_primary: null,
      total_police_contributions: null
    };
    if (d.council_member.facebook_url !== "") {
      info.social.facebook_urls.push(d.council_member.facebook_url);
    }
    if (d.council_member.twitter_handle !== "") {
      info.social.twitter_handles.push(d.council_member.twitter_handle);
    }
    if (d.council_member.instagram_handle !== "") {
      info.social.instagram_handles.push(d.council_member.instagram_handle);
    }
    out[d.district] = info;
  });
  return out;
}

async function getSpreadsheetData() {
  const data = await getCouncilData();
  const doc = new GoogleSpreadsheet(spreadsheet_id);
  doc.useApiKey(google_api_key);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[1];
  await sheet.loadCells();
  const headers = [];
  for (let c = 0; c < sheet.columnCount; c++) {
    headers.push(sheet.getCell(1, c).value);
  }
  for (let r = 2; r < sheet.rowCount; r++) {
    const district = sheet.getCell(r, 0).value;
    if (typeof district !== "number" || district == 37) {
      // skip blank rows and Espinal's district
      continue;
    }
    for (let c = 0; c < sheet.columnCount; c++) {
      if (headers[c].toLowerCase() === "borough") {
        data[district].borough = sheet.getCell(r, c).value;
      } else if (
        headers[c].toLowerCase().includes("phone") &&
        sheet.getCell(r, c).value
      ) {
        sheet
          .getCell(r, c)
          .value.toString()
          .trim()
          .match(/\d{3}[- ]\d{3}[- ]\d{4}/g).forEach(phone => {
          data[district].phones.push([headers[c], phone])  
        });
        
      } else if (
        headers[c].toLowerCase() == "email" &&
        sheet.getCell(r, c).value
      ) {
        data[district].emails = sheet
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
        data[district].public_statements = sheet
          .getCell(r, c)
          .value.toString()
          .match(/\bhttps?[^\s]+/g);
      } else if (headers[c].toLowerCase() === "twitter") {
        const handles = Array.from(sheet
          .getCell(r, c)
          .value.toString()
          .matchAll(/@([^ \n]+)/g), m => m[1]);        
        if (handles) {
          handles.forEach(h => {
            if (
              !data[district].social.twitter_handles
                .map(h => h.toLowerCase())
                .includes(h.toLowerCase())
            ) {
              data[district].social.twitter_handles.push(h);
            }
          });
        }
      } else if (
        headers[c].startsWith("1.") &&
        sheet.getCell(r, c).value.toString() !== "Position Unknown"
      ) {
        data[district].positions.cut_nypd_budget = sheet.getCell(r, c).value;
      } else if (
        headers[c].startsWith("2.") &&
        sheet.getCell(r, c).value.toString() !== "Position Unknown"
      ) {
        data[district].positions.vote_against_status_quo_budget = sheet.getCell(
          r,
          c
        ).value;
      } else if (
        headers[c].startsWith("3.") &&
        sheet.getCell(r, c).value.toString() !== "Position Unknown"
      ) {
        data[district].positions.nypd_cut_amount = sheet.getCell(r, c).value;
      } else if (
        headers[c].toLowerCase().startsWith("budget negotiating team")
      ) {
        data[district].budget_negotiating_team =
          sheet.getCell(r, c).value.toLowerCase() === "yes";
      } else if (headers[c].toLowerCase().indexOf("running in 2020/2021") !== -1) {
        data[district].on_ballot =
          sheet.getCell(r, c).value.toLowerCase() === "yes";
      } else if (
        headers[c].toLowerCase().startsWith("what are they running for") &&
        data[district].on_ballot
      ) {
        let office = sheet.getCell(r, c).value;
        if (office.match(/re-?election/i)) {
          office = "re-election";
        }
        data[district].ballot_position = office;
      } else if (
        headers[c].toLowerCase().startsWith("when is their next primary") &&
        data[district].on_ballot
      ) {
        data[district].next_primary = sheet.getCell(r, c).formattedValue;
      } else if (headers[c].toLowerCase().includes("cop $")) {
        data[district].total_police_contributions = sheet.getCell(
          r,
          c
        ).formattedValue;
      }
    }
  }
  return data;
}

exports.getData = getCouncilData;
exports.getSpreadsheetData = getSpreadsheetData;
