import { createStore, combineReducers } from 'redux';
import {axios, instance} from './http_api.js';
import ward_geo_json from "./Chennai.geojson";
import moment from 'moment';

function handleHttpError(error) {
  console.log(error);
}

const highlightsReducer = function(state, action) {
  var new_state = null;
  if(state === undefined) {
    new_state = {
      "general" : [],
      "alerts" : [],
      "forecasts" : []
    };
  }

  if(action.type === "UPDATE_HIGHLIGHTS") {
    instance.get("/v1/highlights/").then(function(response) {
      store.dispatch({
        type : "HIGHLIGHTS_STATE_UPDATED",
        data : response.data
      })
    }).catch(function (error) {
      handleHttpError(error);
    });
  } else if (action.type === "HIGHLIGHTS_STATE_UPDATED") {
    new_state = Object.assign({}, state, action.data);
  }

  return new_state || state;
}


const forecastsReducer = function(state = {}, action) {
  var new_state = null;

  if(action.type === "UPDATE_FORECASTS") {
    instance.get("/v1/metadata").then(function(response) {
      response.data.forecasts.complaint_types.forEach(function(value) {
        instance.get("/v1/forecasts/complaint_type/" + encodeURIComponent(value)).then(function(response) {
          store.dispatch({
            type : "FORECASTS_STATE_UPDATED",
            complaint_type: value,
            data: response.data
          });
        }).catch(function(error) {
          handleHttpError(error);
        });
      })
    }).catch(function(error) {
      handleHttpError(error);
    })
  } else if (action.type === "FORECASTS_STATE_UPDATED") {
    var o = {};
    o[action.complaint_type] = action.data;
    new_state = Object.assign({}, state, o);
  }

  return new_state || state;
}

const wardMapReducer = function(state, action) {
  var new_state = null;

  if(state === undefined) {
    var date = moment("2014-11-23").toDate(); // TODO make this today later on
    new_state = {
      selected_hour : 0, // default select 0
      ward_geo_json: {}, // geojson for rendering wards
      data: {},
    };

    axios.get(ward_geo_json).then(function(response) {
      store.dispatch({
        type: "GEO_INIT_STATE",
        ward_geo_json: response.data
      });
    }).catch(function(error) {
      handleHttpError(error);
    });


    instance.get("/v1/alerts/counts/ward/" + moment(date).format("YYYY-MM-DD"))
      .then(function(response) {
        store.dispatch({
          type: "GEO_UPDATE_DATA",
          data: response.data
        });
      }).catch(function(error) {
        handleHttpError(error);
      });
  }

  if(action.type === "GEO_INIT_STATE") {
    new_state = Object.assign({}, state, {ward_geo_json: action.ward_geo_json});
  }

  if(action.type === "GEO_UPDATE_DATA") {
    new_state = Object.assign({}, state, {data: action.data});
  }

  if(action.type === "GEO_HOUR_CHANGE") {
    new_state = Object.assign({}, state, {selected_hour: action.selected_hour});
  }


  return new_state || state;
}

const alertsReducer = function(state, action) {
  var new_state = null;

  if(state === undefined) {
    new_state = {
      wards : [],
      complaint_types : [],
      categoryType : "all",
      categoryOption: null,
      selected_date_start: moment(new Date()).subtract(7, "days").toDate(), // default is a one week period
      selected_date_end: new Date(), // date to,
      selected_date_range: "last_week", // by default, show last week
      ward_geo_json: {}, // geojson for rendering wards
      current_data: [],
      current_anomalies: [],
      anomalies_count: 0,
      complaints_count: 0
    };

    // populate initial variables from the API
    instance.get("/v1/metadata").then(function(response) {
      store.dispatch({
        type : "ALERTS_INIT_STATE",
        wards : response.data.alerts.wards,
        complaint_types: response.data.alerts.complaint_types
      });
    }).catch(function(error) {
      handleHttpError(error);
    });
  }

  if(action.type === "ALERTS_INIT_STATE") {
    new_state = Object.assign({}, state, {wards: action.wards, complaint_types: action.complaint_types});
  }




  if(action.type === "ALERTS_UPDATE_STATE") {
    // clone the object
    var action_state = Object.assign({}, action);
    // delete type, so it won't be saved in the state
    delete action_state.type;
    delete action_state.force_call;
    new_state = Object.assign({}, state, action_state);

    var url = null;

    // fetch or change data according to selection
    if(new_state.categoryType === "all") {
      // get city level
      url = "/v1/alerts/city";
    } else if(new_state.categoryType === "ward") {
      // get ward level
      url = "/v1/alerts/ward/" + encodeURIComponent(new_state.selected_ward);
    } else if(new_state.categoryType === "complaint") {
      // get complaint type
      url = "/v1/alerts/complaint_type/" + encodeURIComponent(new_state.selected_complaint_type);
    }

    instance.get(url,{
      params: {
        start_date: moment(new_state.selected_date_start).format("YYYY-MM-DD"),
        end_date: moment(new_state.selected_date_end).format("YYYY-MM-DD"),
      }
    }).then(function(response) {
      store.dispatch({
        type: "ALERTS_UPDATE_DATA",
        current_data: response.data.data,
        current_anomalies: response.data.anomalies,
        complaints_count: response.data.complaints_count,
        anomalies_count: response.data.anomalies_count
      });
    }).catch(function(error) {
      handleHttpError(error);
    });
  }

  if(action.type === "ALERTS_UPDATE_DATA") {
    var parsed_anomalies = action.current_anomalies.map(function(d) {
      return new Date(d);
    });
    new_state = Object.assign({}, state, {
      current_data: action.current_data,
      current_anomalies: parsed_anomalies,
      anomalies_count: action.anomalies_count,
      complaints_count: action.complaints_count
    });
  }

  return new_state || state;
}

// Combine Reducers
const reducers = combineReducers({
  highlights: highlightsReducer,
  forecasts : forecastsReducer,
  alerts: alertsReducer,
  ward_map: wardMapReducer
});

const store = createStore(reducers);


export {store};
