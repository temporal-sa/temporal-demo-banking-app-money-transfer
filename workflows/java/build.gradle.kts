plugins {
    java
    application
}

application {
    mainClass.set("banking.BankingWorker")
    applicationName = "worker"
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("io.temporal:temporal-sdk:1.40.0")
    implementation("io.temporal:temporal-envconfig:1.40.0")
    implementation("org.slf4j:slf4j-simple:2.0.17")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}
