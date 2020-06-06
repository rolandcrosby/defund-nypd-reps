const sheetData = {};
let district = null;

const autocomplete = new google.maps.places.Autocomplete(
  document.getElementById("address-field"),
  {
    // https://www1.nyc.gov/assets/planning/download/pdf/data-maps/open-data/nybb_metadata.pdf?ver=18c
    bounds: new google.maps.LatLngBounds(
      { lat: 40.495992, lng: -74.257159 },
      { lat: 40.915568, lng: -73.699215 }
    ),
    types: ["address"],
    strictBounds: true,
    fields: ["address_components"]
  }
);

google.maps.event.addListener(autocomplete, "place_changed", async function() {
  geocode();
});

document.forms[0].onsubmit = function(e) {
  e.preventDefault();
};

document.getElementById("district-selector").onchange = async function(e) {
  setDistrict(parseInt(e.target.value, 10));
  document.getElementById("address-field").value = "";
  await render(district);
};

const parts = window.location.pathname.split("/");
if (parts.length >= 3 && parts[1] === "district") {
  const d = parseInt(parts[2])
  if (!isNaN(d) && d > 0 && d <= 51) {
    setDistrict(d)
    document.getElementById("address-field").value = "";
    render(district);
  }
}

function setDistrict(d) {
  district = d;
  document.getElementById("district-selector").value = district;
  history.replaceState(d, `/district/${d}`, `/district/${d}`);
}

async function geocode() {
  if (!autocomplete.getPlace() || !autocomplete.getPlace().address_components) {
    return;
  }
  status("Loading…");
  const addressInfo = autocomplete.getPlace().address_components;
  const q = {};
  addressInfo.forEach(f => {
    if (f.types.includes("street_number")) {
      q.houseNumber = f.short_name;
    } else if (f.types.includes("route")) {
      q.street = f.short_name;
    } else if (f.types.includes("postal_code")) {
      q.zip = f.short_name;
    }
  });
  const response = await fetch(
    `/geoclient-proxy?houseNumber=${encodeURIComponent(
      q.houseNumber
    )}&street=${encodeURIComponent(q.street)}&zip=${encodeURIComponent(q.zip)}`
  );
  const responseJSON = await response.json();
  if (responseJSON.address && responseJSON.address.cityCouncilDistrict) {
    setDistrict(parseInt(responseJSON.address.cityCouncilDistrict, 10));
  }
  if (!district) {
    status("Couldn’t find your district");
    return;
  }
  document.getElementById("district-selector").value = district;
  render(district);
}

function status(innerHTML) {
  document.querySelector("#result").innerHTML = innerHTML;
}

async function render(district) {
  status("Loading…");
  if (!sheetData.byDistrict) {
    const sheetResponse = await fetch("/sheet");
    sheetData.byDistrict = await sheetResponse.json();
  }
  const info = sheetData.byDistrict[district];
  if (info.name === "Vacant") {
    document.querySelector(
      "#result"
    ).outerHTML = `<div id="result">The council seat in district ${district} is currently vacant.</div>`;
    return;
  }
  const statementData = makeStatements(info.statements);
  document.querySelector("#result").outerHTML = `<div id="result">
    <div class="bio">
    <div class="img"><img src="https://raw.githubusercontent.com/NewYorkCityCouncil/districts/master/thumbnails/district-${escape(
      district
    )}.jpg" alt="${escape(info.name)}"></div>
    <div class="info">
    <h3>${escape(info.name)}</h3>
    <h4>${escape(info.borough)}, District ${escape(info.district)}</h4>
    <p><a href="https://council.nyc.gov/district-${escape(
      info.district
    )}/">Council Website</a></p>
    ${Object.entries(info.phones)
      .map(
        p =>
          `<p>${escape(p[0])}: ${p[1]
            .map(ph => `<a href="tel:${escape(ph)}">${escape(ph)}</a>`)
            .join(", ")}</p>`
      )
      .join("")}
    <p><a href="mailto:${escape(info.email.join(","))}">Email</a>
    </div>
    </div>
    <dl>
    ${info.fields
      .filter(f => f[0].match(/^\d\./))
      .map(f => `<dt>${escape(f[0])}</dt><dd>${escape(f[1])}</dd>`)
      .join("")}
    </dl>
  ${statementData.html}
  <details><summary>More Information</summary>
    ${info.fields
      .filter(f => !f[0].match(/^\d\./))
      .map(f => `<dt>${escape(f[0])}</dt><dd>${escape(f[1])}</dd>`)
      .join("")}
  </details>
  </div>`;
  if (statementData.loaders.length > 0) {
    statementData.loaders.forEach(f => window.setTimeout(f, 100));
  }
}

function makeStatements(statements) {
  const out = { html: "", loaders: [] };
  if (statements.length == 0) {
    return out;
  }
  out.html = `<h3>Public Statements</h3>`;
  statements.forEach(s => {
    const twitterMatch = s.match(
      /^https:\/\/(?:[A-z0-9-]*\.)?twitter.com\/[A-z0-9_]+\/status\/([0-9]+)/
    );
    if (twitterMatch) {
      out.html += `<div class="tweet" id="tweet${twitterMatch[1]}"></div>`;
      out.loaders.push(function() {
        twttr.widgets.createTweet(
          twitterMatch[1],
          document.getElementById(`tweet${twitterMatch[1]}`)
        );
      });
    } else {
      out.html += `<p><a href="${escape(s)}">${escape(s)}</a></p>`;
    }
  });
  return out;
}

function escape(text) {
  if (text === null || typeof text === "undefined") {
    return "";
  }
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
