import { expect, test } from "vitest";
import { LNPEncoder } from "../packages/index";

const data = [{"id":1,"first_name":"Hedvig","last_name":"Walkingshaw","email":"hwalkingshaw0@eepurl.com","gender":"Female","ip_address":"177.87.56.200"},
{"id":2,"first_name":"Larry","last_name":"Jahnisch","email":"ljahnisch1@nydailynews.com","gender":"Male","ip_address":"249.171.252.5"}]

const encodedData = "a281:o138:2:idn1:110:first_names6:Hedvig9:last_names11:Walkingshaw5:emails24:hwalkingshaw0@eepurl.com6:genders6:Female10:ip_addresss13:177.87.56.200o133:2:idn1:210:first_names5:Larry9:last_names8:Jahnisch5:emails26:ljahnisch1@nydailynews.com6:genders4:Male10:ip_addresss13:249.171.252.5"
const encoder = new LNPEncoder();


test("LNP Encoding", () => {
    expect(encoder.encode(data).toString("utf8")).toBe(encodedData);
});
