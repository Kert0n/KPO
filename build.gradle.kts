plugins {
    id("org.jetbrains.kotlin.jvm")
}

kotlin { jvmToolchain(21) }

dependencies { implementation(kotlin("test")) }

sourceSets {
    main { kotlin.srcDir(".generated/kotlin-snippets/src/main/kotlin") }
}

tasks.named("compileKotlin") { dependsOn("extractKotlinSnippets") }

tasks.register<Exec>("extractKotlinSnippets") {
    commandLine("node", "--experimental-strip-types", "scripts/extract-kotlin-snippets.mts")
    inputs.files(fileTree("content") { include("**/*.md") })
    inputs.file("kotlin-snippets.count")
    outputs.dir(".generated/kotlin-snippets")
}
