namespace WMS.Api.Authentication;

public sealed record NeonJwtSettings(string Issuer, Uri JwksUri);
