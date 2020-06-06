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

document.forms[0].onsubmit = function(e) {e.preventDefault();}

document.getElementById("district-selector").onchange = async function(e) {
  district = parseInt(e.target.value, 10);
  document.getElementById("address-field").value = "";
  await render(district);
};

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
    district = parseInt(responseJSON.address.cityCouncilDistrict, 10);
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
    document.querySelector("#result").outerHTML = `<div id="result">The council seat in district ${district} is currently vacant.</div>`;
    return;
  }
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
    ${Object.entries(info.phones).map(
      p =>
        `<p>${escape(p[0])}: ${p[1]
          .map(ph => `<a href="tel:${escape(ph)}">${escape(ph)}</a>`)
          .join(", ")}</p>`
    ).join("")}
    <p><a href="mailto:${escape(info.email.join(","))}">Email</a>
    </div>
    </div>
    <dl>
    ${info.fields
      .map(f => `<dt>${escape(f[0])}</dt><dd>${escape(f[1])}</dd>`)
      .join("")}
    </dl>
  </div>`;
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

