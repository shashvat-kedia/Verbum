package com.sk.learning;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.netflix.appinfo.InstanceInfo;
import com.netflix.discovery.DiscoveryClient;

@RestController
public class ServiceInstanceRestController {

    @Autowired
    private DiscoveryClient discoveryClient;

    @RequestMapping("/instance-info/{applicationId")
    public List<InstanceInfo> serviceInstancesByApplicationId(@PathVariable String applicationId) {
        return this.discoveryClient.getInstancesById(applicationId);
    }
}
