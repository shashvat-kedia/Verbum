package com.sk.learning;

import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LearningController {
    private static final Logger LOOGGER = LoggerFactory.getLogger(LearningController.class.getName());
    private final AtomicLong counter = new AtomicLong();
}
