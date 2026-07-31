package qg.po.midterm;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import io.sentry.spring7.EnableSentry;

@EnableSentry(
    dsn = "https://e46378eb75244b37876c1adcfe6990fd@o4511829869199360.ingest.us.sentry.io/4511830110306304",
    sendDefaultPii = true
)
@SpringBootApplication
@MapperScan("qg.po.midterm.mapper")
public class MidTermApplication {

    public static void main(String[] args) {
        SpringApplication.run(MidTermApplication.class, args);
    }

}
