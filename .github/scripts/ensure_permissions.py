import os

def main():
    manifest_path = "android/app/src/main/AndroidManifest.xml"
    with open(manifest_path, "r") as f:
        content = f.read()

    permissions = [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        'android.permission.WAKE_LOCK',
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        'android.permission.ACCESS_WIFI_STATE',
        'android.permission.CHANGE_WIFI_STATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.USE_EXACT_ALARM',
    ]

    if 'xmlns:tools' not in content:
        content = content.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ')

    for perm in permissions:
        perm_line = f'<uses-permission android:name="{perm}" />'
        if perm not in content:
            if '<uses-permission android:name="android.permission.INTERNET" />' in content:
                content = content.replace(
                    '<uses-permission android:name="android.permission.INTERNET" />',
                    f'<uses-permission android:name="android.permission.INTERNET" />\n    {perm_line}'
                )
            else:
                # Fallback insertion
                content = content.replace(
                    '<application',
                    f'{perm_line}\n    <application'
                )

    with open(manifest_path, "w") as f:
        f.write(content)

    print("✅ All permissions added")

if __name__ == "__main__":
    main()
