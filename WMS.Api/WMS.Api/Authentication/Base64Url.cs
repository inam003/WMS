namespace WMS.Api.Authentication;

internal static class Base64Url
{
    public static byte[] Decode(string value)
    {
        if (value.Length == 0 || value.Any(character =>
                !(character is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or
                    >= '0' and <= '9' or '-' or '_')))
        {
            throw new FormatException("Invalid base64url value.");
        }

        var base64 = value.Replace('-', '+').Replace('_', '/');
        base64 += (base64.Length % 4) switch
        {
            0 => string.Empty,
            2 => "==",
            3 => "=",
            _ => throw new FormatException("Invalid base64url value."),
        };

        return Convert.FromBase64String(base64);
    }
}
