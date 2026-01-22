import os

def main():
    main_activity_path = "android/app/src/main/java/com/itaxibcn/app/MainActivity.java"
    with open(main_activity_path, "r") as f:
        content = f.read()

    if "ProTrackingPlugin" in content:
        print("✅ Already registered")
        return

    # Add import
    content = content.replace(
        "import com.getcapacitor.BridgeActivity;",
        "import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;\nimport com.itaxibcn.app.tracking.ProTrackingPlugin;"
    )

    # Add onCreate with registerPlugin
    if "onCreate" not in content:
        content = content.replace(
            "public class MainActivity extends BridgeActivity {",
            '''public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }'''
        )
    else:
        content = content.replace(
            "super.onCreate(savedInstanceState);",
            "registerPlugin(ProTrackingPlugin.class);\n        super.onCreate(savedInstanceState);"
        )

    with open(main_activity_path, "w") as f:
        f.write(content)

    print("✅ Plugin registered in MainActivity")

if __name__ == "__main__":
    main()
