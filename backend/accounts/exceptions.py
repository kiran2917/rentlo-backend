from rest_framework.views import exception_handler
from rest_framework.exceptions import Throttled

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if isinstance(exc, Throttled) and response is not None:
        wait = exc.wait
        if wait is not None:
            if wait >= 3600:
                hours = round(wait / 3600, 1)
                time_str = f"{hours} hour{'s' if hours > 1 else ''}"
            elif wait >= 60:
                minutes = int(wait // 60)
                time_str = f"{minutes} minute{'s' if minutes > 1 else ''}"
            else:
                time_str = f"{int(wait)} second{'s' if int(wait) > 1 else ''}"

            response.data['detail'] = f"API rate limit reached to prevent automated scraping. Please try again in {time_str}."
            response.data['wait_seconds'] = int(wait)
        else:
            response.data['detail'] = "Too many requests. Please slow down and try again shortly."

    return response
