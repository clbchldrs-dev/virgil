import { tool } from "ai";
import { z } from "zod";
import { companionToolFailure } from "@/lib/ai/companion-tool-result";
import { assertAgentFetchUrlAllowed } from "@/lib/http/agent-egress";

async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  assertAgentFetchUrlAllowed(geocodeUrl);
  try {
    const response = await fetch(geocodeUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch {
    return null;
  }
}

export const getWeather = tool({
  description:
    "Get the current weather at a location. You can provide either coordinates or a city name.",
  inputSchema: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    city: z
      .string()
      .describe("City name (e.g., 'San Francisco', 'New York', 'London')")
      .optional(),
  }),
  needsApproval: true,
  execute: async (input) => {
    try {
      let latitude: number;
      let longitude: number;

      if (input.city) {
        const coords = await geocodeCity(input.city);
        if (!coords) {
          return companionToolFailure({
            error: "companion_weather_geocode_failed",
            errorCode: "weather_geocode_not_found",
            retryable: false,
            message: `Could not find coordinates for "${input.city}". Check the city name or pass latitude and longitude.`,
          });
        }
        latitude = coords.latitude;
        longitude = coords.longitude;
      } else if (
        input.latitude !== undefined &&
        input.longitude !== undefined
      ) {
        latitude = input.latitude;
        longitude = input.longitude;
      } else {
        return companionToolFailure({
          error: "companion_weather_invalid_input",
          errorCode: "weather_missing_location",
          retryable: false,
          message:
            "Provide either a city name or both latitude and longitude coordinates.",
        });
      }

      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`;
      assertAgentFetchUrlAllowed(forecastUrl);
      const response = await fetch(forecastUrl);

      if (!response.ok) {
        return companionToolFailure({
          error: "companion_weather_forecast_http_error",
          errorCode: "weather_forecast_http_error",
          retryable: true,
          message: `Weather API returned HTTP ${String(response.status)}.`,
        });
      }

      const weatherData = await response.json();

      if (weatherData && typeof weatherData === "object") {
        const o = weatherData as Record<string, unknown>;
        if ("city" in input) {
          o.cityName = input.city;
        }
      }

      return weatherData;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      return companionToolFailure({
        error: "companion_weather_request_failed",
        errorCode: "weather_request_failed",
        retryable: true,
        message: `Weather request failed: ${msg}`,
      });
    }
  },
});
