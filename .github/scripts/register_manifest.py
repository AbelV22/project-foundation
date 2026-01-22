import os

def main():
    manifest_path = "android/app/src/main/AndroidManifest.xml"
    with open(manifest_path, "r") as f:
        content = f.read()

    if "LocationTrackingService" in content:
        print("✅ Already registered")
        return

    # Use raw string for service declaration to detect correct indentation if needed, 
    # but here we just append it before </application>
    service_declaration = """
        <!-- Pro Location Tracking Service -->
        <service
            android:name=".tracking.LocationTrackingService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="location" />

        <!-- Alarm Receiver for Doze mode -->
        <receiver
            android:name=".tracking.AlarmReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="com.itaxibcn.app.LOCATION_ALARM" />
            </intent-filter>
        </receiver>
    """

    content = content.replace("</application>", service_declaration + "\n    </application>")

    with open(manifest_path, "w") as f:
        f.write(content)

    print("✅ Service and receivers registered")

if __name__ == "__main__":
    main()
