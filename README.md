Sick of depending on Fastlane or bumping versions manually?

This action uses semantic commits to automate version bumping in native Android repos and creates a version commit and git tag.
By using this action, your CI runner can examine the commits in the event and bump the semantic version accordingly as long as you are using conventional commits.
If you are not using conventional commits, it will just bump the patch version consistently.

Keep in mind that the max patch version is 99 on Android if you use the default version code generator. Inspired by [npm version bump](https://github.com/phips28/gh-action-bump-version). :tada:

## Installation

### GitHub Actions

#### Dependencies

Use `actions/checkout@v6` or greater before running the action.
The action runs as a bundled Node 24 JavaScript action, so workflow consumers do not need Docker, `npm install`, or `node_modules`.

#### .github/workflows/release.yml

Add the following to your yaml workflow declaration.
Make sure to bump **before** building any artifacts so that the correct versions are applied.
For Kotlin DSL builds, pass the generated outputs into Gradle as project properties.

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0

- name: Bump version
  id: bump_version
  uses: oflynned/android-version-bump@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Build release
  run: >
    ./gradlew :app:assembleRelease
    -PversionName=${{ steps.bump_version.outputs.version_name }}
    -PversionCode=${{ steps.bump_version.outputs.version_code }}
```

Use `version_name` for Android's user-facing version, `version_code` for Android's monotonic integer version code, and `git_tag` for release or deployment steps that need the git tag.

Pin to a version tag instead of `master` if you want fully repeatable workflow runs.

#### Commit range

By default, the action reads commit messages from git history between the previous matching tag and `HEAD`.
Use `fetch-depth: 0` with `actions/checkout` so the runner has enough history and tags to find that range.
If no matching previous tag exists, the action reads all reachable commits.
If the git range cannot be read, the action falls back to the GitHub event payload for compatibility.

| Range        | Behavior                                                                      |
|--------------|-------------------------------------------------------------------------------|
| previous-tag | Reads commits from the previous tag matching `commit_tag_pattern` to `HEAD`.  |
| base-ref     | Reads commits from `commit_base_ref` to `HEAD`.                               |
| payload      | Reads commit messages from the GitHub event payload, matching older behavior. |

For pull request or protected-branch workflows, set an explicit base ref:

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0

- name: Bump version
  id: bump_version
  uses: oflynned/android-version-bump@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    commit_range: base-ref
    commit_base_ref: origin/main
```

#### Private repos

To use this action with `${{ secrets.GITHUB_TOKEN }}` in a private repo, set `contents: write` so the token can push the version commit and tag.

```yaml
jobs:
  publish:
    ...
    permissions:
      contents: write
```

### Android Studio

#### version.properties

The CI will create a `version.properties` by default, but you can also create this yourself to set the first version **to bump from**.
Remember, creating a file with 0.0.1 will bump it to 0.0.2 on first run.
Not creating any `version.properties` will make the CI action handle this edge case itself and create the first version 0.0.1 without bumping.

```properties
majorVersion=1
minorVersion=0
patchVersion=0
buildNumber=
```

The build number can remain unset if you are using the default version name generators below.
The generated `version_code` output uses the deterministic default formula `major * 10000 + minor * 100 + patch`.

#### Version storage

The default `version_storage` backend is `version-properties`, which reads and writes `version.properties` in the repository root.
Projects that already keep shared Gradle settings in `gradle.properties` can use the `gradle-properties` backend instead.

Both supported backends use the same keys:

```properties
majorVersion=1
minorVersion=0
patchVersion=0
buildNumber=
```

| Backend            | File                 | Behavior                                                          |
|--------------------|----------------------|-------------------------------------------------------------------|
| version-properties | `version.properties` | Compatibility default. The action writes the version keys file.   |
| gradle-properties  | `gradle.properties`  | The action updates the version keys and preserves unrelated keys. |

To use `gradle.properties`:

```yaml
- name: Bump version
  id: bump_version
  uses: oflynned/android-version-bump@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    version_storage: gradle-properties
```

#### build.gradle.kts / Kotlin DSL

For Kotlin DSL projects, pass the generated values from GitHub Actions into Gradle as project properties.
This is the recommended CI setup because it avoids duplicating version logic in `build.gradle.kts`.

```yaml
- name: Bump version
  id: bump_version
  uses: oflynned/android-version-bump@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Build release
  run: >
    ./gradlew :app:assembleRelease
    -PversionName=${{ steps.bump_version.outputs.version_name }}
    -PversionCode=${{ steps.bump_version.outputs.version_code }}
```

Then read those properties from your module-level `build.gradle.kts`:

```kotlin
android {
    defaultConfig {
        versionName = providers.gradleProperty("versionName").get()
        versionCode = providers.gradleProperty("versionCode").get().toInt()
    }
}
```

If you also want local Android Studio builds to work before CI has passed properties into Gradle, load the root `version.properties` file as a fallback in the same module-level `build.gradle.kts`:

```kotlin
import java.util.Properties

val versionProperties = Properties().apply {
    val versionFile = rootProject.file("version.properties")

    if (versionFile.exists()) {
        versionFile.inputStream().use(::load)
    }
}

fun versionPart(name: String): String = versionProperties.getProperty(name, "0")

fun getVersionCode(): Int {
    val major = versionPart("majorVersion").toInt()
    val minor = versionPart("minorVersion").toInt()
    val patch = versionPart("patchVersion").toInt()

    return major * 10000 + minor * 100 + patch
}

fun getVersionName(): String {
    val major = versionPart("majorVersion")
    val minor = versionPart("minorVersion")
    val patch = versionPart("patchVersion")
    val build = versionProperties.getProperty("buildNumber", "")
    val versionName = "$major.$minor.$patch"

    return if (build.isNotBlank()) "$versionName.$build" else versionName
}

android {
    defaultConfig {
        versionName = providers.gradleProperty("versionName").orNull ?: getVersionName()
        versionCode = providers.gradleProperty("versionCode").orNull?.toInt() ?: getVersionCode()
    }
}
```

#### build.gradle / Groovy

`build.gradle` will not use these values unless you add some logic to it.

The version properties file must first be loaded into the Gradle context.
Add this to the top of `build.gradle`

```groovy
Properties props = new Properties()
props.load(new FileInputStream("$project.rootDir/version.properties"))
props.each { prop ->
    project.ext.set(prop.key, prop.value)
}
```

You can define how version name & codes are generated in that file:

```groovy
private Integer getVersionCode() {
    int major = ext.majorVersion as Integer
    int minor = ext.minorVersion as Integer
    int patch = ext.patchVersion as Integer

    return major * 10000 + minor * 100 + patch
}

private String getVersionName() {
    if (ext.buildNumber) {
        return "${ext.majorVersion}.${ext.minorVersion}.${ext.patchVersion}.${ext.buildNumber}"
    }

    return "${ext.majorVersion}.${ext.minorVersion}.${ext.patchVersion}"
}
```

You then use those two functions in your config in the same file:

```groovy
android {
    defaultConfig {
        versionCode getVersionCode()
        versionName getVersionName()
    }
}
```

## Workflow

### Major

Bumps on the following intents:

```text
major: drop support for api v21
```

Also triggered if the commit body contains `BREAKING CHANGE` or if the intent contains a `!`.

```text
refactor!: drop support for api v21
refactor: BREAKING CHANGE drop support for api v21
```

If any commit like this is in the list of commits within the event, then the **major** version will get bumped (`1.0.0 -> 2.0.0`)

### Minor

Bumps on the following intents:

```text
feat: add oauth login with google
minor: allow user to delete account
```

If any commit like this is in the list of commits within the event, then the **minor** version will get bumped (`1.0.0 -> 1.1.0`)

### Patch

Any other changes, even if not following conventional commits will bump the patch version (`1.0.0 -> 1.0.1`)

### Build number

This field is optional.

Providing the build number will automatically affix this to the version name

Enable this field by passing a build number/string/SHA as an input to the action:

```yaml
- name: Bump version
  id: bump_version
  uses: oflynned/android-version-bump@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    build_number: ${{ github.run_number }}
```

## Optional arguments

Pass these in the `with:` block

| Tag                | Effect                                                                                                                                                                         | Example                                                                            | Default value            |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|--------------------------|
| commit_range       | Selects where version bump commit messages come from. Supported values are `previous-tag`, `base-ref`, and `payload`.                                                          | `commit_range: base-ref` reads from `commit_base_ref` to `HEAD`                    | `previous-tag`           |
| commit_base_ref    | Base ref used when `commit_range` is `base-ref`. If omitted, pull request workflows use `origin/${{ github.base_ref }}` when available.                                        | `commit_base_ref: origin/main`                                                     | ''                       |
| commit_tag_pattern | Tag glob used when `commit_range` is `previous-tag`.                                                                                                                           | `commit_tag_pattern: 'v*'`                                                         | `*`                      |
| version_storage    | Selects where version metadata is read from and written to. Supported values are `version-properties` and `gradle-properties`.                                                 | `version_storage: gradle-properties` updates `gradle.properties`                   | `version-properties`     |
| tag_prefix         | Prefix used in the generated release commit message. The git tag, `git_tag`, and `new_tag` outputs remain the unprefixed version.                                              | `tag_prefix: 'release-'` makes the default commit message `release: release-1.0.0` | `v`                      |
| skip_ci            | Affixes `[skip-ci]` to the end of the commit message, even if you provide a custom message                                                                                     | `skip_ci: false`                                                                   | true                     |
| build_number       | Sets the build run number in the version                                                                                                                                       | `build_number: ${{ github.run_number }}` generates `1.0.0.5`                       | ''                       |
| commit_message     | Sets the commit message when a release bump is performed. Can optionally use `{{ version }}` to insert the generated version bump with the tag prefix into the commit message. | `ci: {{ version }} was just released into the wild! :tada: :partying_face:`        | `release: {{ version }}` |

## Outputs

| Name         | Description                        | Example   |
|--------------|------------------------------------|-----------|
| git_tag      | The newly created git tag          | `1.0.0`   |
| version_name | The generated Android version name | `1.0.0.5` |
| version_code | The generated Android version code | `10000`   |
| new_tag      | Compatibility alias for `git_tag`  | `1.0.0`   |

## Q&A

### I need to also create a release, not just a tag

The action also outputs a tag that you can use in later stages of the workflow like so.

```yaml
- name: Create release
  id: create_release
  uses: actions/create-release@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tag_name: ${{ steps.bump_version.outputs.git_tag }}
    release_name: ${{ steps.bump_version.outputs.git_tag }}
    draft: false
    prerelease: false
```

Make sure you also assign the bump version step its own id (in this case it was already set to `id: bump_version`)
Older workflows can keep using `new_tag`; it is preserved as a compatibility alias for `git_tag`.
