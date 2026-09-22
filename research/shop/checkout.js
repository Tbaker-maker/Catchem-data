/**
 * Catch'em checkout resolver.
 * Feature-gated. Nothing here takes money until rails.enabled flags are true
 * AND checkout-config.json "enabled" is true AND destination emails/addresses exist.
 */

export function loadConfig(raw) {
  if (!raw || raw.version !== 1) {
    throw new Error("checkout-config.json missing or wrong version");
  }
  return raw;
}

export function availableRails(config, { country, merchandiseUsd }) {
  if (!config.enabled) return [];
  const out = [];
  const paypal = config.rails.paypal;
  if (paypal.enabled && paypal.merchantEmail) out.push(paypal);

  const interac = config.rails.interac;
  if (
    interac.enabled &&
    interac.autodepositEmail &&
    interac.allowedCountries.includes(country)
  ) {
    out.push(interac);
  }

  const crypto = config.rails.crypto;
  const liveAssets = (crypto.assets || []).filter((a) => a.enabled && a.address);
  if (
    crypto.enabled &&
    liveAssets.length &&
    Number(merchandiseUsd) >= Number(crypto.minMerchandiseUsd || 0)
  ) {
    out.push({ ...crypto, assets: liveAssets });
  }
  return out;
}

export function quoteShipping(config, { country, merchandiseUsd, pack = "packet" }) {
  const ship = config.shipping;
  if (!ship.trackedOnly) {
    throw new Error("untracked shipping is forbidden");
  }
  if (pack === "box") {
    return {
      billedTo: "buyer",
      service:
        country === "CA" ? ship.caDefaultService : ship.usDefaultService,
      amountUsd: ship.ratesUsd.usBox || ship.ratesUsd.caBox || null,
      calculated: true,
      signature: merchandiseUsd >= ship.signatureAtUsd,
      insurance: merchandiseUsd >= ship.insuranceAtUsd,
    };
  }

  const isCA = country === "CA";
  const freeCA =
    isCA &&
    ship.freeTrackedCanadaAtCad != null &&
    merchandiseUsd >= ship.freeTrackedCanadaAtCad;
  const freeUS =
    !isCA &&
    ship.freeTrackedUsPacketAtUsd != null &&
    merchandiseUsd >= ship.freeTrackedUsPacketAtUsd;

  const amountUsd = isCA ? ship.ratesUsd.caPacket : ship.ratesUsd.usPacket;
  return {
    billedTo: freeCA || freeUS ? "seller" : "buyer",
    service: isCA ? ship.caDefaultService : ship.usDefaultService,
    amountUsd: freeCA || freeUS ? 0 : amountUsd,
    calculated: false,
    signature: merchandiseUsd >= ship.signatureAtUsd,
    insurance: merchandiseUsd >= ship.insuranceAtUsd,
    duties: !isCA && ship.buyerPaysUsDuties ? "buyer" : "none",
  };
}

export function assertReadyToEnable(config) {
  const errors = [];
  if (!config.enabled) errors.push("store.enabled is false");
  const anyRail =
    config.rails.paypal.enabled ||
    config.rails.interac.enabled ||
    config.rails.crypto.enabled;
  if (!anyRail) errors.push("no rail enabled");
  if (config.rails.paypal.enabled && !config.rails.paypal.merchantEmail) {
    errors.push("paypal.merchantEmail empty");
  }
  if (config.rails.interac.enabled && !config.rails.interac.autodepositEmail) {
    errors.push("interac.autodepositEmail empty");
  }
  if (config.rails.crypto.enabled) {
    const live = (config.rails.crypto.assets || []).filter((a) => a.enabled && a.address);
    if (!live.length) errors.push("crypto enabled but no asset address");
  }
  if (!config.shipping.trackedOnly) errors.push("trackedOnly must stay true");
  return errors;
}

export function buildOrderDraft({
  config,
  country,
  merchandiseUsd,
  railId,
  shipTo,
  items,
}) {
  const rails = availableRails(config, { country, merchandiseUsd });
  const rail = rails.find((r) => r.id === railId);
  if (!rail) {
    throw new Error("rail not available for this buyer / amount / flag set");
  }
  if (!shipTo || !shipTo.line1 || !shipTo.country) {
    throw new Error("ship-to required; no label without a locked address");
  }
  const shipping = quoteShipping(config, { country, merchandiseUsd });
  return {
    status: "awaiting_settled_funds",
    rail: rail.id,
    oneRail: true,
    items,
    merchandiseUsd,
    shipping,
    shipTo,
    shipOnScreenshot: false,
    copy: config.copy.checkoutBlurb,
  };
}
