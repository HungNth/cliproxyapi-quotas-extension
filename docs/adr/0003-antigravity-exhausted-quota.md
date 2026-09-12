# Treat omitted Antigravity fraction with reset time as exhausted quota

In Google Cloud Code Assist (Antigravity), upstream model endpoints omit the optional `remainingFraction` field when capacity is exhausted and only return `resetTime`. The extension normalizes this condition to 0% remaining capacity rather than unavailable data so that users can see that the model is exhausted and observe its reset countdown. Models lacking both fields remain represented as unavailable data.
