package qg.po.midterm;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("qg.po.midterm.mapper")
public class MidTermApplication {

    public static void main(String[] args) {
        SpringApplication.run(MidTermApplication.class, args);
    }

}
