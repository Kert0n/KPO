plugins {
  kotlin("jvm") version "2.4.0"
}

kotlin {
  jvmToolchain(21)
}

sourceSets {
  main {
    kotlin.srcDir(layout.buildDirectory.dir("generated/src/main/kotlin"))
  }
}
