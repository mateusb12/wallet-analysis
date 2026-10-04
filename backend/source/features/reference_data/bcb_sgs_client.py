from datetime import date, datetime
from html import unescape
from xml.etree import ElementTree

import requests


REST_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_id}/dados"
SOAP_URL = "https://www3.bcb.gov.br/wssgs/services/FachadaWSSGS"


def fetch_series(series_id: int, start_date: str, end_date: str) -> list[dict[str, str]]:
    """Fetch an SGS series, preferring REST and falling back to the official SOAP service."""
    try:
        response = requests.get(
            REST_BASE_URL.format(series_id=series_id),
            params={
                "formato": "json",
                "dataInicial": start_date,
                "dataFinal": end_date,
            },
            headers={"User-Agent": "wallet-analysis/1.0"},
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            return data
    except (requests.RequestException, ValueError):
        pass

    return _fetch_series_soap(series_id, start_date, end_date)


def _fetch_series_soap(series_id: int, start_date: str, end_date: str) -> list[dict[str, str]]:
    body = f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:pub="http://publico.ws.casosdeuso.sgs.pec.bcb.gov.br"
    xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/">
  <soapenv:Header/>
  <soapenv:Body>
    <pub:getValoresSeriesXML soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <in0 xsi:type="def:ArrayOfflong" soapenc:arrayType="xsd:long[]"
          xmlns:def="http://schemas.xmlsoap.org/soap/encoding/">
        <oidSerie>{series_id}</oidSerie>
      </in0>
      <in1 xsi:type="xsd:string">{start_date}</in1>
      <in2 xsi:type="xsd:string">{end_date}</in2>
    </pub:getValoresSeriesXML>
  </soapenv:Body>
</soapenv:Envelope>'''

    response = requests.post(
        SOAP_URL,
        data=body.encode("utf-8"),
        headers={
            "Accept": "text/xml",
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "urn:#getValoresSeriesXML",
        },
        timeout=30,
    )
    response.raise_for_status()

    root = ElementTree.fromstring(response.content)
    xml_payload = "".join(root.itertext())
    payload_root = ElementTree.fromstring(unescape(xml_payload)) if "<SERIE" in xml_payload else root

    records = []
    for series in payload_root.findall(".//SERIE"):
        for item in series:
            values = {element.tag.upper(): (element.text or "").strip() for element in item}
            if values.get("DATA") and values.get("VALOR"):
                records.append({"data": values["DATA"], "valor": values["VALOR"]})
    return records


def default_date_range() -> tuple[str, str]:
    today = date.today()
    return "01/01/1992", today.strftime("%d/%m/%Y")


def parse_series_date(value: str) -> str:
    """Normalize daily and monthly SGS dates to ISO format."""
    raw = value.strip()
    for pattern in ("%d/%m/%Y", "%m/%Y", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(raw, pattern)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Formato de data SGS não suportado: {value!r}")
