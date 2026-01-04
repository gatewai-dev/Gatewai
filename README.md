# GATEWAI

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## Support

Join our Stargazers ⭐!

![Click](/assets/ddr.gif "Click")

## Build node-canvas

By default, "canvas" package is not being built with pnpm for security reasons.

To make it build, run

```sh
cd apps/gatewai-fe
pnpm approve-builds
```

## Google Bucket & Project Creation

To create a JSON credentials file (often called a Service Account Key), you need to use the Google Cloud Console. This file acts as the "identity" for your application, allowing it to interact with Cloud Storage.

Here is the step-by-step process:

1. Create a Service Account
Go to the IAM & Admin > Service Accounts page in the Google Cloud Console.

Select your Project.

Click + Create Service Account at the top.

Enter a name (e.g., "storage-manager") and click Create and Continue.

1. Assign the Correct Permissions
To make your code work, the service account needs permission to manage objects.

In the Role dropdown, search for and select:

Storage Object Admin (Full control over objects, including upload/delete).

Click Continue and then Done.

3. Generate and Download the JSON Key
In the list of service accounts, click on the Email address of the account you just created.

Click on the Keys tab on the right menu.

Click Add Key > Create new key.

Select JSON as the key type and click Create.

A JSON file will automatically download to your computer. Move the downloaded file to /apps/gatewai-fe folder.

### In your .env file

```text
GOOGLE_APPLICATION_CREDENTIALS="/name-of-the-file"
```

For example:
GOOGLE_APPLICATION_CREDENTIALS=/gatewai-466716-6a4cc3da9bc4.json

⚠️ Security Warning
Never commit your JSON key file to Git. Add the filename to your .gitignore immediately. If the key is leaked, anyone can access your storage buckets and potentially incur high costs or delete your data.
