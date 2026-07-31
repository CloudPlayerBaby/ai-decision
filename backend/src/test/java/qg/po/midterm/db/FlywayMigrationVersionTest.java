package qg.po.midterm.db;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;

class FlywayMigrationVersionTest {

    private static final Pattern VERSION = Pattern.compile("^V([^_]+)__.*\\.sql$");

    @Test
    void migrationVersionsAreUnique() throws IOException {
        Set<String> versions = new HashSet<>();
        try (var files = Files.list(Path.of("src/main/resources/db/migration"))) {
            files.filter(Files::isRegularFile).forEach(file -> {
                Matcher matcher = VERSION.matcher(file.getFileName().toString());
                if (matcher.matches()) {
                    assertTrue(versions.add(matcher.group(1)),
                            "重复的 Flyway 版本: " + matcher.group(1));
                }
            });
        }
    }
}
