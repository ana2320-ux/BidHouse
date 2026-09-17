package com.bidhouse.demo.Controladores;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TestController {

    @GetMapping("/status")
    public String getStatus() {
        return "El backend de BidHouse está melo";
    }
}