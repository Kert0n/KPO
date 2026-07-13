pluginManagement {
    val kotlinVersion = file(".vitepress/shared/kotlinTooling.ts")
        .readText()
        .let { Regex("KOTLIN_VERSION\\s*=\\s*'([^']+)'" ).find(it)?.groupValues?.get(1) }
        ?: error("KOTLIN_VERSION is missing")
    plugins { id("org.jetbrains.kotlin.jvm") version kotlinVersion }
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { mavenCentral() }
}

rootProject.name = "kpo-kotlin-snippets"
