import { expect, it } from "@jest/globals";
import MockDate from "mockdate";

import { getAggregateWorkingHours } from "@calcom/core/getAggregateWorkingHours";

MockDate.set("2021-06-20T11:59:59Z");

const HAWAII_AND_NEWYORK_TEAM = [
  {
    timeZone: "America/Detroit", // GMT -4 per 22th of Aug, 2022
    workingHours: [{ days: [1, 2, 3, 4, 5], startTime: 780, endTime: 1260 }],
    busy: [],
  },
  {
    timeZone: "Pacific/Honolulu", // GMT -10 per 22th of Aug, 2022
    workingHours: [
      { days: [3, 4, 5], startTime: 0, endTime: 360 },
      { days: [6], startTime: 0, endTime: 180 },
      { days: [2, 3, 4], startTime: 780, endTime: 1439 },
      { days: [5], startTime: 780, endTime: 1439 },
    ],
    busy: [],
  },
];

/* TODO: Make this test more "professional" */
it("Sydney and Shiraz can live in harmony 🙏", async () => {
  expect(getAggregateWorkingHours(HAWAII_AND_NEWYORK_TEAM, "COLLECTIVE")).toMatchInlineSnapshot(`
    Array [
      Object {
        "days": Array [
          3,
          4,
          5,
        ],
        "endTime": 360,
        "startTime": 780,
      },
      Object {
        "days": Array [
          6,
        ],
        "endTime": 180,
        "startTime": 0,
      },
      Object {
        "days": Array [
          2,
          3,
          4,
        ],
        "endTime": 1260,
        "startTime": 780,
      },
      Object {
        "days": Array [
          5,
        ],
        "endTime": 1260,
        "startTime": 780,
      },
    ]
  `);
});
