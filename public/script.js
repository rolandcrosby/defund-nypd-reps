Vue.filter("capitalize", function(value) {
  if (!value) return "";
  value = value.toString();
  return value.charAt(0).toUpperCase() + value.slice(1);
});

Vue.component("Tweet", {
  props: ['id'],
  template: `<div ref="tweetContainer"></div>`,
  mounted: function() {
    this.$nextTick(function() {
      twttr.widgets.createTweet(this.id, this.$refs.tweetContainer);
    });
  },
  watch: {
    id: function(newID, oldID) {
      if (newID !== oldID) {
        this.$nextTick(function() {
          this.$refs.tweetContainer.innerHTML = "";
          twttr.widgets.createTweet(newID, this.$refs.tweetContainer);
        })
      }
    }
  }
});

const app = new Vue({
  el: ".app",
  data: {
    district: 0,
    byDistrict: {},
    address: ""
  },
  created: function() {
    fetch("/sheet")
      .then(response => response.json())
      .then(json => {
        this.byDistrict = json;
      })
      .catch(e => {});
  },
  computed: {
    member: function() {
      if (
        this.district &&
        this.byDistrict &&
        this.byDistrict.hasOwnProperty(this.district.toString())
      ) {
        return this.byDistrict[this.district.toString()];
      } else {
        return null;
      }
    }
  },
  methods: {
    menuChanged: function() {
      this.address = "";
      setDistrict(this.district);
    },
    tweetID: function(value) {
      const match = value
        .toString()
        .match(
          /^https:\/\/(?:[A-z0-9-]*\.)?twitter.com\/[A-z0-9_]+\/status\/([0-9]+)/
        );
      if (match) {
        return match[1];
      } else {
        return "";
      }
    }
  }
});

function setDistrict(d) {
  let parsed = parseInt(d);
  if (!isNaN(d) && d > 0 && d <= 51) {
    app.district = parsed;
    history.replaceState(parsed, `/district/${parsed}`, `/district/${parsed}`);
  }
}

function setStatus(status) {
  app.status = status;
}

const parts = window.location.pathname.split("/");
if (parts.length >= 3 && parts[1] === "district") {
  setDistrict(parts[2]);
}

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
    fields: ["address_components", "formatted_address"]
  }
);

google.maps.event.addListener(autocomplete, "place_changed", async function() {
  console.log();
  geocode();
});

document.forms[0].onsubmit = function(e) {
  e.preventDefault();
};

async function geocode() {
  if (!autocomplete.getPlace() || !autocomplete.getPlace().address_components) {
    app.address = "";
    return;
  }
  console.log(autocomplete.getPlace());
  app.address = autocomplete.getPlace().formatted_address;
  setStatus("Loading…");
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
  // todo: handle error here
}
