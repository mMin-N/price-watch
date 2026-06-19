import { describe, it, expect } from "vitest";
import { parseMeeshoPage } from "./meesho";

describe("parseMeeshoPage", () => {
  it("parses __NEXT_DATA__ product price", () => {
    const html = `
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"product":{"name":"Kurti Set","price":399,"in_stock":true}}}}
      </script>
    `;
    expect(parseMeeshoPage(html)).toMatchObject({
      price: 399,
      currency: "INR",
      title: "Kurti Set",
      isAvailable: true,
    });
  });

  it("parses initialState.product.details.data path", () => {
    const html = `
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"initialState":{"product":{"details":{"data":{"name":"KURTI","price":197,"in_stock":true}}}}}}}
      </script>
    `;
    expect(parseMeeshoPage(html)).toMatchObject({
      price: 197,
      currency: "INR",
      title: "KURTI",
      isAvailable: true,
    });
  });

  it("parses meta product price", () => {
    const html = '<meta property="product:price:amount" content="249" />';
    expect(parseMeeshoPage(html)).toMatchObject({
      price: 249,
      currency: "INR",
    });
  });
});
