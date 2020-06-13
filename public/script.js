if (window.location.protocol === 'http:') {
  window.location.replace(window.location.href.replace(/^http:/, 'https:'));
}

Vue.filter("capitalize", function(value) {
  if (!value) return "";
  value = value.toString();
  return value.charAt(0).toUpperCase() + value.slice(1);
});

Vue.filter("possessive", function(value) {
  if (value === "male") {
    return "his";
  } else if (value === "female") {
    return "her";
  } else {
    return "their";
  }
});

Vue.component("Tweet", {
  props: ["id"],
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
        });
      }
    }
  }
});

const app = new Vue({
  el: ".app",
  data: {
    district: 0,
    byDistrict: {},
    address: "",
    error: null,
    constituent: {
      name: "",
      borough: "",
    },
    emailVisible: false,
  },
  created: function() {
    fetch("/sheet")
      .then(response => response.json())
      .then(json => {
        this.byDistrict = json;
      })
      .catch(e => {
        app.error =
          "Sorry, a problem occurred while retrieving councilmember data.";
      });
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
    },
    memberEmails: function() {
      if (this.member) {
        return this.member.emails.join(",");
      } else {
        return Object.values(app.byDistrict).flatMap(obj => obj.emails).join(",");
      }
    }
  },
  methods: {
    menuChanged: function() {
      this.address = "";
      this.invalidateEmail();
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
    },
    invalidateEmail: function() {
      this.emailContent = "";
      this.emailVisible = false;
      if (this.$refs.emailCompose) {
        this.$refs.emailCompose.value = "";  
      }
    },
    generateEmail: function() {
      var valid = true;
      if (this.constituent.name.trim() === "") {
        this.emailContent = "";
        this.$refs.constituentName.className = "invalid";
        valid = false;
      } else {
        this.$refs.constituentName.className = "";
      }
      if (this.constituent.borough.trim() === "") {
        this.emailContent = "";
        this.$refs.constituentBorough.className = "invalid";
        valid = false;
      } else {
        this.$refs.constituentBorough.className = "";
      }
      if (!valid) {
        return;
      }
      const greeting = this.member ? `Councilmember ${this.member.last_name}` : 'Councilmembers';
      this.$nextTick(function() {
        this.$refs.emailCompose.value = `Dear ${greeting},

My name is ${this.constituent.name} and I am a resident of ${this.constituent.borough}. Last April, NYC Mayor Bill De Blasio proposed major budget cuts for the Fiscal Year 2021, especially to education and youth programs, while refusing to slash the NYPD budget. While he's since committed to "reducing" the NYPD budget, it is city council's duty to hold the mayor accountable to his statements, and ensure that the city budget reflects the needs and interests of the New York City community.

I urge you to consider pressuring the office of the mayor towards an ethical and equal reallocation of the NYC expense budget. This means cutting overtime, implementing a hiring freeze to prevent violent over-policing, a moratorium on equipment, firearm, and military expenses, and an overall cut of at least $1 billion to the NYPD budget this year.

As someone who cares deeply about our city, I urge you to vote YES to a budget that significantly defunds the police. I am also asking that Council members remain transparent with their residents on the process of negotiation in the coming month, and publicly make a definitive statement in support of #DefundNYPD before the end of the month, so residents can hold them accountable.

It is more clear to me than ever that true community safety comes from investing in education, our youth, healthcare, housing, and other social services — not an over-militarized police with little to no accountability. For the sake of our city, please commit to defunding the NYPD.

Thank you,
${this.constituent.name}`;
      });
      this.emailVisible = true;
    },
    sendMailto: function() {
      const subject = encodeURIComponent("I'm calling on you to defund the NYPD");
      const body = encodeURIComponent(this.$refs.emailCompose.value);
      const mailtoUrl = `mailto:${this.memberEmails}?subject=${subject}&body=${body}`;
      window.location = mailtoUrl;
    },
    sendGmail: function() {
      const subject = encodeURIComponent("I'm calling on you to defund the NYPD");
      const body = encodeURIComponent(this.$refs.emailCompose.value);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}&to=${this.memberEmails}`
      window.open(gmailUrl, "_blank");
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
  try {
    const response = await fetch(
      `/geoclient-proxy?houseNumber=${encodeURIComponent(
        q.houseNumber
      )}&street=${encodeURIComponent(q.street)}&zip=${encodeURIComponent(
        q.zip
      )}`
    );
    const responseJSON = await response.json();
    if (responseJSON.address && responseJSON.address.cityCouncilDistrict) {
      setDistrict(parseInt(responseJSON.address.cityCouncilDistrict, 10));
    }
  } catch (e) {
    app.error = "Sorry, an error occurred while looking up your address.";
  }
}
