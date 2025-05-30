Zenoti Docs 
Request:
const options = {
  method: 'POST',
  headers: {accept: 'application/json', 'content-type': 'application/json'},
  body: JSON.stringify({
    account_name: 'account name',
    user_name: 'username',
    password: 'Enter your password',
    grant_type: 'password',
    app_id: 'DB6D3C87-7913-43E3-81B6-08B0F1708D09',
    app_secret: '312a4d9488e04a829fe9dab88377e78f8e071240f3e241ca82e01c306e556599',
    device_id: 'c113476f-04e1-484c-b887-57414441cdcf'
  })
};

fetch('https://api.zenoti.com/v1/tokens', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response:
{
  "credentials": {
    "access_token": "AN:blushstage|$ARD#SJjGgi8HWG1ok7ffVnm5CgAF4JMZYZT1UoY3A3VCP40YHU8MaQnEkhXWUNdZt/2dCnQNLxv4CeQJz2usidkbJUyRqnNeVLa3ikFrBPCjcXwU3PAzFe8uhOoivMD+Lj9cLOxjSNwpD23R60qCz6a08zNtRWp/Fg7sYjrUwvgPGS8foqJTY2vJZHs71X8y3Q6zsJhOL7hCCT7Rb6VgNd0KPEDoCv0yCvby1bLgMfDmyK3hS1fkL7+ubWW1TXkFpBFquE6SqOafMwfaaVD1NPOij/VrOe3DkhFY2v3B5NPp9UMLgsIAEqWGMlRv+uc7nIfh4nwH0IWZybgxC1JY+tuH7yIxTp9niqgG8ou1+dF3AWiq+rvTJxX7Hjm6keagwunnlTW1+zEm5Kmwgh12lZRQ1DxNUkoqEQSlPHZDVzhhwb16xkxS8q4U/1+kxtpfk8nMteCcn3K+SdEst06J1ShyoIaVJkkNN/NAZERkqIPsZUtDIvXGw+IfjZbu1/FFOKp+PLOZLrE0BptfGHqY6IP73z7Ri3EeAPsJzGM0mMNEnZMK+LxkPaGl28sKKfgWXaUl1Jct9QKtJ/5Io7SyEtSdcQ/DHSxXYzNT7JdhizE5FWSWqv1/y8ZRdE5RQurJrUErSOWnHmS8qkDdZz0Ps3I2SpIb41pcypU+d5NhL4WW46WBhms2uZ0HxzzHcE4MzRLLZb5nvnJHo2HxIJh1Ud1sY6hY1g8pg4ujokxS7vkc6NQ6/yitgPZoiACfoYMMNgucozpXjbdNwK72rF4XBmFayxLeptMwcG6ZwpKiL4SE6l+4/rwPU+fx29TBNroWHzK23Fbut0eGKQFDgOd+sVvzKkZjx0oF8VKb2px6vVSzbrwDIJebxJpEpv5OJghESGlGKIuzEHZMit7fseDUQPfA2/1+C7wEYkCJoF/nbWe/eW9MYQWTT7Yd9SO4uVzCU8ETj2nfeTDG4jgbYbHPynMj7W56crXY1wC67knxqiVSJbOsWLLcgcBOjBrl0EH0gseuG6rkmPaQAQNQ/RFLNKxpBQRBcpMrLv5Gdb4=",
    "access_token_expiry": "2022-06-08T11:19:18.7016839Z",
    "refresh_token": "AN:blushstage|$ARD#tkfrIhypyBpbgcF5AmASnE+L+NzMqOhdn0qg/lZPjNDtdFHE/WD0Llf94jg3mWVN92qp2UPFKBknecdB4SfPvVeI/lurj93b71nzsPZbMNJMoDjFnD65Xhnm5K7U7KPzghZO7VyHYttogs2AStI7RbvWtEmUerv/uc0d/jSBATg+UlMm1xzkesw1uoIAW5yYeakbpJzKEtvVid0wq7wXwFKyvw4jiK9RDrGzmRl13slB99MchKiWHGGEh16CoWtnwKEy8xnnDRdimUhd6suHoiET6CBU4oFNQoei5ei5X0DPdSYYvTZaHJulCxH/CfNk48xmLQSCQH5t8Ewy4beqmQVYDzT3oENZS6bMNZ6tnU4Y44e6xnO4K9THSQuYgttNUMo8vQmhq+33ZmBDaizw7UgJleNjFxD4oSQng+JNABIZKEyzaH1o/KrhaNs/NNzlqi4r54xcveXpZ0S1arvJ7a8mMf6/LAFZ8Uo315ylzw05rf99GHM9WwZwQsTFU6g64/5aOmTshD/hA5STKiP9m+ro3a+mvvJQJyf43GO86pcuSuLiHP2E9/jBCQ7MVHoLpwFJEmUZRJuW2o5lZhHB2oHpSNoZXRaD61uoW//c8YtXJ0vDHeehnX6KJbuYUOKwMmeYga+oOGvxQoctAxr3PcpUaWksctoR+nKYrRxnHCwnCRr+r3B0Oujuv0aVPBhlWn+AU/9aCPR2fAeQsNdREj3ZjC9RjAP4spZ4OfJboryxb5uqqMUWyTPPsl+uJiJmy3+yPuZW6ivKxusSEax+ZFL1F58oEj88BJtB71r0v9Ktn0QTfTZs3EBzBtE0Hacl8BJ88a3pbajUVq8238NM7Dwqxy1rfDSIiPO7HHA0ZmiuWK6CPJRA1+utaGBUP7AM2/Ji9aOTPMRRZvJuMq5nKCM/vFUE2ISZnU2zdwAz8RAEGeD2BBmPIR7mNiH28LqrgJHytt8Fhy73+79CHti8ln7H7/4o+Z421LW7DK+KD0NVPopEqEkFnhTbCdMogh/W44VioK51E/4KuzlFXfK+7lrOAkDS91aw7K8=",
    "refresh_token_expiry": "2022-09-05T11:19:18.7172608Z",
    "token_type": "bearer",
    "token_id": "b2bf3b23-430a-4aba-bec4-c70c21de733a",
    "app_id": "DB6D3C87-7913-43E3-81B6-08B0F1708D09",
    "user_type": "Employee"
  },
  "login_policy_evaluation": {
    "allowlogin": true,
    "policyaction": 0,
    "policyactiondata": null,
    "userid": null,
    "passwordexpiryreminder": false
  },
  "error": null
}


GET https://api.zenoti.com/v1/centers?expand=working_hours

const options = {
  method: 'GET',
  headers: {accept: 'application/json', Authorization: 'apikey <your api key>'}
};

fetch('https://api.zenoti.com/v1/centers?catalog_enabled=false&expand=working_hours', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

{
  "memberships": [
    {
      "id": "6a1bf622-d343-47f4-be65-a5dccace7f03",
      "version_id": "c33f162d-7758-4d39-96dd-c6e5901bdfcc",
      "name": "- BMW First Class Membership",
      "price": {
        "currency_id": 61,
        "sales": 1789,
        "tax": 0,
        "final": 1789
      },
      "can_book": true,
      "show_price": true,
      "display_name": null,
      "display_price": null,
      "image_paths": null,
      "is_recurring_membership": false,
      "membership_type": 0,
      "first_collection_after": 0,
      "description": "",
      "html_description": null,
      "terms_and_conditions": null,
      "terms_and_conditions_acceptance": null,
      "enforce_mandatory_fields": false,
      "payment_frequency": ""
    }
  ],
  "total_no_of_memberships": 78,
  "benefits": null,
  "page_info": null,
  "error": null
}

Response: 
{
  "memberships": [
    {
      "id": "bf6da36a-f402-4f66-b6d1-953829288a83",
      "version_id": "bf6da36a-f402-4f66-b6d1-953829288a83",
      "name": "Guest Pass MEmbership Two - Cloned",
      "price": {
        "currency_id": 61,
        "sales": 150,
        "tax": 0,
        "final": 150
      },
      "can_book": true,
      "show_price": true,
      "display_name": null,
      "display_price": null,
      "image_paths": null,
      "is_recurring_membership": true,
      "membership_type": 1,
      "first_collection_after": 0,
      "description": "",
      "html_description": null,
      "terms_and_conditions": null,
      "terms_and_conditions_acceptance": null,
      "enforce_mandatory_fields": false,
      "payment_frequency": "12 Months"
    }
  ],
  "total_no_of_memberships": 1,
  "benefits": {
    "services": [],
    "classes": [
      {
        "membership_id": "bf6da36a-f402-4f66-b6d1-953829288a83",
        "category": {
          "id": "9e6df039-c66c-49ab-b385-11a6f6d810fa",
          "name": "Payrates "
        },
        "parent": {
          "id": "70019c0a-4347-4c3a-81b0-2a53b8704270",
          "name": "Aerobics"
        },
        "grand_parent": {
          "id": null,
          "name": null
        },
        "level": 4,
        "assigned_count": 1,
        "is_category": true,
        "quantity": 145,
        "allowed_quantity_in_frequency": 0,
        "frequency_mode": -1,
        "frequency": null,
        "expiration_days": 0,
        "peak_discount": 0,
        "off_peak_discount": 0,
        "post_credit_consumption_peak_discount": 0,
        "post_credit_consumption_off_peak_discount": 0
      },
      {
        "membership_id": "bf6da36a-f402-4f66-b6d1-953829288a83",
        "category": {
          "id": "daa80415-9aef-4fa5-9a8b-0c34da31e272",
          "name": "Yoga"
        },
        "parent": {
          "id": "b3a4d323-acd0-404f-95f6-fd8dddf9ba31",
          "name": "Classes"
        },
        "grand_parent": {
          "id": null,
          "name": null
        },
        "level": 2,
        "assigned_count": 1,
        "is_category": false,
        "quantity": 125,
        "allowed_quantity_in_frequency": 0,
        "frequency_mode": -1,
        "frequency": null,
        "expiration_days": 0,
        "peak_discount": 0,
        "off_peak_discount": 0,
        "post_credit_consumption_peak_discount": 0,
        "post_credit_consumption_off_peak_discount": 0
      }
    ],
    "workshops": [],
    "products": null,
    "discounts": {
      "classes": [
        {
          "membership_id": "bf6da36a-f402-4f66-b6d1-953829288a83",
          "category": {
            "id": "9e6df039-c66c-49ab-b385-11a6f6d810fa",
            "name": "Payrates "
          },
          "parent": {
            "id": "70019c0a-4347-4c3a-81b0-2a53b8704270",
            "name": "Aerobics"
          },
          "grand_parent": {
            "id": null,
            "name": null
          },
          "level": 4,
          "assigned_count": 0,
          "is_category": true,
          "quantity": 0,
          "allowed_quantity_in_frequency": 0,
          "frequency_mode": null,
          "frequency": -1,
          "expiration_days": 0,
          "peak_discount": null,
          "off_peak_discount": null,
          "post_credit_consumption_peak_discount": null,
          "post_credit_consumption_off_peak_discount": null
        },
        {
          "membership_id": "bf6da36a-f402-4f66-b6d1-953829288a83",
          "category": {
            "id": "daa80415-9aef-4fa5-9a8b-0c34da31e272",
            "name": "Yoga"
          },
          "parent": {
            "id": "b3a4d323-acd0-404f-95f6-fd8dddf9ba31",
            "name": "Classes"
          },
          "grand_parent": {
            "id": null,
            "name": null
          },
          "level": 2,
          "assigned_count": 0,
          "is_category": false,
          "quantity": 0,
          "allowed_quantity_in_frequency": 0,
          "frequency_mode": null,
          "frequency": -1,
          "expiration_days": 0,
          "peak_discount": null,
          "off_peak_discount": null,
          "post_credit_consumption_peak_discount": null,
          "post_credit_consumption_off_peak_discount": null
        }
      ],
      "services": []
    }
  },
  "page_info": {
    "total": 1,
    "page": 25,
    "size": 1
  },
  "error": null
}



GET https://api.zenoti.com/v1/Centers/{center_id}

Response
{
  "center": {
    "id": "34f7b069-1bce-4f24-b9b2-f58ebbf768f0",
    "name": "Zenoti Inc.",
    "code": "Z001",
    "phone": "0000000000",
    "time_zone_id": 6,
    "currency_id": 148,
    "email": "apisupport@zenoti.com"
  },
  "error": null
}




GET https://api.zenoti.com/{api_url} /v1/Centers/{center_id}/services
Request
const options = {
  method: 'GET',
  headers: {accept: 'application/json', Authorization: 'apikey <your api key>'}
};

fetch('https://api.zenoti.com/api_url%20/v1/Centers/center_id/services', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "services": [
    {
      "id": "ec85d12b-eca3-4bfd-89a6-9082dce1cf86",
      "code": "Z",
      "name": "0 mins",
      "description": "",
      "duration": 0,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 100,
        "tax_id": "",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 0,
        "price_without_tax": 100,
        "final_price": 100
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "e659c739-2ce3-4073-b2c2-191910436e09",
      "code": "000SHC",
      "name": "000 Simple Service",
      "description": "",
      "duration": 90,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 100,
        "tax_id": "cb3ef725-56f4-47fb-a608-cc798ff3a5c9",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 43,
        "price_without_tax": 100,
        "final_price": 143
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "9c11945c-8779-4a64-9af1-3af5ad8fe213",
      "code": "0SS",
      "name": "0min segment service",
      "description": "",
      "duration": 0,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 100,
        "tax_id": "",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 0,
        "price_without_tax": 100,
        "final_price": 100
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "d180bfc4-61c7-43bb-aa42-04dc9f5c3c6b",
      "code": "",
      "name": "123",
      "description": "",
      "duration": 0,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 200,
        "tax_id": "",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 0,
        "price_without_tax": 200,
        "final_price": 200
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "479ea2bb-cf8d-4355-8709-e11adfc123ec",
      "code": "",
      "name": "Abdomen Wax - Male",
      "description": "Hair is removed from your sternum to your hip bones, so your belly is fully bare.",
      "duration": 15,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 150,
        "tax_id": "",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 0,
        "price_without_tax": 150,
        "final_price": 150
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "95cd81af-6287-457f-b364-72ec167a2084",
      "code": "",
      "name": "Abdomen Wax - Male2",
      "description": "Hair is removed from your sternum to your hip bones, so your belly is fully smooth.",
      "duration": 30,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 100,
        "tax_id": "",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 0,
        "price_without_tax": 100,
        "final_price": 100
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "02fd0c14-5661-4308-8661-f97793b9a783",
      "code": "AddOn3",
      "name": "AddOn3",
      "description": "",
      "duration": 15,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 300,
        "tax_id": "db1033a9-3a9e-45ca-a33d-2f104a6be0df",
        "ssg": 0,
        "include_tax": true,
        "demand_group_id": "",
        "tax": 50,
        "price_without_tax": 250,
        "final_price": 300
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "43ef9509-5374-49e9-97ce-cc3435344644",
      "code": "AddonCanBookTesting",
      "name": "AddonCanBookTesting",
      "description": "",
      "duration": 36,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 100,
        "tax_id": "e8e3ba77-7a9f-4f73-b522-c5df925a5797",
        "ssg": 0,
        "include_tax": true,
        "demand_group_id": "",
        "tax": 20,
        "price_without_tax": 80,
        "final_price": 100
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "d8ff753c-1dcb-4c36-a9d9-a12132fed0c3",
      "code": "",
      "name": "AddonMassage",
      "description": "",
      "duration": 0,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 10,
        "tax_id": "cb3ef725-56f4-47fb-a608-cc798ff3a5c9",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 4.3,
        "price_without_tax": 10,
        "final_price": 14.3
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    },
    {
      "id": "56a47e8b-1165-4d42-8c3a-7f59c27d0207",
      "code": "SRV00005",
      "name": "AHA Manicure",
      "description": "",
      "duration": 45,
      "recovery_time": 0,
      "is_couple_service": false,
      "price_info": {
        "currency_id": 148,
        "sale_price": 0,
        "tax_id": "",
        "ssg": 0,
        "include_tax": false,
        "demand_group_id": "",
        "tax": 0,
        "price_without_tax": 0,
        "final_price": 0
      },
      "additional_info": null,
      "catalog_info": null,
      "variants_info": null,
      "add_ons_info": null,
      "image_paths": null,
      "parallel_groups": null,
      "parallel_service_groups": null,
      "prerequisites_info": null,
      "finishing_services_info": null
    }
  ],
  "page_info": {
    "total": 70,
    "page": 1,
    "size": 10
  }
}





GET https://api.zenoti.com/v1/centers/{center_id}/employees
Request
const options = {
  method: 'GET',
  headers: {accept: 'application/json', Authorization: 'apikey <your api key>'}
};

fetch('https://api.zenoti.com/v1/centers/center_id/employees?page=1&size=10', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "employees": [
    {
      "id": "af14d51c-556a-419a-a6d7-eb7df7369041",
      "code": "009",
      "personal_info": {
        "first_name": "Amy",
        "last_name": "Brown",
        "name": "Amy Brown",
        "gender": 1
      },
      "job_info": {
        "id": "0548b6f3-cecc-49c0-baab-558b4f019d1c",
        "name": "THERAPIST"
      }
    },
    {
      "id": "e7017bf4-7921-4e7e-b63b-66ad7744ec34",
      "code": "",
      "personal_info": {
        "first_name": "proteam02",
        "last_name": "owner",
        "name": "proteam02 owner",
        "gender": 0
      },
      "job_info": {
        "id": "75f623b3-7b5b-409f-b76e-0ce680c23c6b",
        "name": "Owner"
      }
    },
    {
      "id": "b0e159f8-a576-4146-a905-cf433b37b32a",
      "code": "21",
      "personal_info": {
        "first_name": "Proteam02_mgr",
        "last_name": "mgr",
        "name": "Proteam02_mgr mgr",
        "gender": 0
      },
      "job_info": {
        "id": "c925db19-3ff4-4ad1-bfd5-8d94212f874a",
        "name": "MANAGER"
      }
    },
    {
      "id": "f856bdab-1cba-4299-999c-35f8dc0034b1",
      "code": "rs1",
      "personal_info": {
        "first_name": "runscopeuser",
        "last_name": "amrs01",
        "name": "runscopeuser amrs01",
        "gender": 1
      },
      "job_info": {
        "id": "83e4b1de-f903-40f0-917e-f81b2537f500",
        "name": "OWNER"
      }
    },
    {
      "id": "5d4f8e9a-3769-4f8c-905f-cd88a00bdae6",
      "code": "7777",
      "personal_info": {
        "first_name": "Simon",
        "last_name": "Simu",
        "name": "Simon Simu",
        "gender": 0
      },
      "job_info": {
        "id": "83e4b1de-f903-40f0-917e-f81b2537f500",
        "name": "OWNER"
      }
    }
  ]
}


GET https://api.zenoti.com/v1/centers/{center_id}/therapists

Request
const options = {
  method: 'GET',
  headers: {accept: 'application/json', Authorization: 'apikey <your api key>'}
};

fetch('https://api.zenoti.com/v1/centers/center_id/therapists', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "therapists": [
    {
      "id": "1afd493a-4aad-48a3-8f94-9fdea88691ac",
      "code": "60",
      "personal_info": {
        "first_name": "Ajay",
        "last_name": "Kumar Singh",
        "name": "Ajay Kumar Singh",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "aacf1d0d-abb9-41af-b44a-eb2de9f9d207",
        "name": "Skin Therapist"
      }
    },
    {
      "id": "955d352f-b8f1-4737-82ad-bd2af7129236",
      "code": "EMP07093",
      "personal_info": {
        "first_name": "Ajay",
        "last_name": "Meena",
        "name": "Ajay Meena",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "ead03cb7-7e2d-4e51-b169-69fe25e318b2",
      "code": "132",
      "personal_info": {
        "first_name": "Apurva",
        "last_name": "Jain",
        "name": "Apurva Jain",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "54cb0d10-b473-4d4f-ad55-737934315408",
        "name": "Make Up Artist"
      }
    },
    {
      "id": "df454873-6757-4e44-8478-9871113d35c6",
      "code": "EMP13153",
      "personal_info": {
        "first_name": "Ashfaq",
        "last_name": "Ahmed",
        "name": "Ashfaq Ahmed",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "13b01732-d952-404b-aa23-22b1dd468d0b",
        "name": "Hair Stylist"
      }
    },
    {
      "id": "a71e47bd-d4c5-4827-bf82-759e922ae7fa",
      "code": "117",
      "personal_info": {
        "first_name": "Avneet",
        "last_name": "Kaur",
        "name": "Avneet Kaur",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "b9fe77bd-4628-49fd-a557-4864080c818f",
      "code": "003",
      "personal_info": {
        "first_name": "Azad",
        "last_name": "Kalam",
        "name": "Azad Kalam",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "c8621ce4-09fa-40b3-be9a-e11816f913e8",
      "code": "037",
      "personal_info": {
        "first_name": "Bharti",
        "last_name": "Gupta",
        "name": "Bharti Gupta",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "4833d833-3068-4c0a-87c4-0495aa871057",
        "name": "Beautician"
      }
    },
    {
      "id": "d08df92f-4a7d-41d5-b9b9-29699c4e2633",
      "code": "13",
      "personal_info": {
        "first_name": "Bhuvaneswar",
        "last_name": "Kumar",
        "name": "Bhuvaneswar Kumar",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "7a8f5ebb-a7c8-497d-8b48-5c8e72df858f",
      "code": "45",
      "personal_info": {
        "first_name": "Budheswar",
        "last_name": "Prasad Upadhyay",
        "name": "Budheswar Prasad Upadhyay",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "dec7eb59-512a-4e73-84ee-8de0b6129734",
      "code": "8",
      "personal_info": {
        "first_name": "Christopher",
        "last_name": "Campbell",
        "name": "Christopher Campbell",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "6372bb51-e507-4431-b0cc-6be2143bb99a",
      "code": "108",
      "personal_info": {
        "first_name": "Deepali",
        "last_name": "Sinha",
        "name": "Deepali Sinha",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "91dd215c-2f4b-4e19-8992-ece0e5679ac0",
      "code": "90",
      "personal_info": {
        "first_name": "Divya",
        "last_name": "Khosla",
        "name": "Divya Khosla",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "40f0052e-6a8b-4928-8104-4e1c05b2aa44",
      "code": "09890",
      "personal_info": {
        "first_name": "Divya",
        "last_name": "Shukla",
        "name": "Divya Shukla",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "0fb56383-295e-4546-a874-481affcb0ce1",
      "code": "78",
      "personal_info": {
        "first_name": "Dr. Priyanka",
        "last_name": "Prabhakar",
        "name": "Dr. Priyanka Prabhakar",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "f263157d-bd10-4dc3-bebc-1c1b876d6dea",
      "code": "113",
      "personal_info": {
        "first_name": "Dr. Puneet",
        "last_name": "Tanwar",
        "name": "Dr. Puneet Tanwar",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "162472bd-bd27-480c-9b80-c7cbdff76bd8",
      "code": "010",
      "personal_info": {
        "first_name": "Dr. Renu",
        "last_name": "Chabbra",
        "name": "Dr. Renu Chabbra",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "239a56c0-92f0-4f6e-a0c7-16e3a76d3741",
      "code": "150",
      "personal_info": {
        "first_name": "Dr. Roshan",
        "last_name": "Karan",
        "name": "Dr. Roshan Karan",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "c30536d4-2332-4acb-83a0-56d61b9425d2",
      "code": "EMP13823",
      "personal_info": {
        "first_name": "Gaurav",
        "last_name": "Kumar",
        "name": "Gaurav Kumar",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "4c77fc88-269c-43a0-a7f4-c060ee5600ab",
      "code": "029",
      "personal_info": {
        "first_name": "Ginu",
        "last_name": "Abraham",
        "name": "Ginu Abraham",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "1737875d-f3c1-4737-9d54-2867898bc64d",
        "name": "Nurse"
      }
    },
    {
      "id": "50a3adb7-339e-4554-8311-540447ca93dc",
      "code": "26",
      "personal_info": {
        "first_name": "Hanumanthu",
        "last_name": "Vijayam",
        "name": "Hanumanthu Vijayam",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "5f3f8ef3-72e9-4560-ac82-e5b5f82b91a4",
      "code": "80",
      "personal_info": {
        "first_name": "HEMA",
        "last_name": "BHATT",
        "name": "HEMA BHATT",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "4833d833-3068-4c0a-87c4-0495aa871057",
        "name": "Beautician"
      }
    },
    {
      "id": "e66041d1-9d45-4fb5-8914-419bcaedc98f",
      "code": "104",
      "personal_info": {
        "first_name": "Indra",
        "last_name": "Massa",
        "name": "Indra Massa",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0e47d7cd-15b1-4e4b-bbdd-9db7dc8b02af",
        "name": "Masseur"
      }
    },
    {
      "id": "f0ff2dab-0435-493b-a1c2-68d0e48cd55a",
      "code": "14",
      "personal_info": {
        "first_name": "Jagjeevan",
        "last_name": "Ram",
        "name": "Jagjeevan Ram",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "5cb5d3ec-813e-4f0b-b05c-32b5b6c0b36a",
      "code": "76",
      "personal_info": {
        "first_name": "JAI",
        "last_name": "PRAKASH",
        "name": "JAI PRAKASH",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0910409a-b008-40b6-a031-ac2de77196ae",
        "name": "Pedicurist"
      }
    },
    {
      "id": "1f48ed11-9bf3-4fbf-bf91-37a3836efa04",
      "code": "4",
      "personal_info": {
        "first_name": "Neharika",
        "last_name": "Jwala",
        "name": "Jwala Nick",
        "nick_name": "Jwala Nick",
        "gender": "0"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "4888bf50-19ea-4b2a-b705-6fc757e92c1b",
      "code": "118",
      "personal_info": {
        "first_name": "Kanchan",
        "last_name": "Khurana",
        "name": "Kanchan Khurana",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "732d1488-43c1-4c25-8b81-98951111d9e8",
      "code": "030",
      "personal_info": {
        "first_name": "Kasim",
        "last_name": "Ali",
        "name": "Kasim Ali",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "eb6cc2ee-04ea-4a24-abca-bbbb8b25e372",
      "code": "12",
      "personal_info": {
        "first_name": "Kavita",
        "last_name": "Khare",
        "name": "Kavita Khare",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "de6f22ad-f92a-4d60-ab1a-6b9e6018ed11",
      "code": "022",
      "personal_info": {
        "first_name": "Khushi",
        "last_name": "Ram",
        "name": "Khushi Ram",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "fb1bb437-994a-4806-b7af-dd23718b5452",
      "code": "75",
      "personal_info": {
        "first_name": "KIRAN",
        "last_name": "BHARTI",
        "name": "KIRAN BHARTI",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "b1b7deda-c5ae-4b3f-a9b8-67163cc7e5be",
      "code": "77",
      "personal_info": {
        "first_name": "Kirti",
        "last_name": "Arora",
        "name": "Kirti Arora",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "23588c84-8ef7-49cc-a4aa-0ff5d8efcdc6",
      "code": "44",
      "personal_info": {
        "first_name": "Kranthi",
        "last_name": "Vir",
        "name": "Kranthi Vir",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "5e243fbf-8d44-4048-bd75-f28c24bfb5ed",
      "code": "EMP13513",
      "personal_info": {
        "first_name": "Kumari",
        "last_name": "Kusum Chauhan",
        "name": "Kumari Kusum Chauhan",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "d61c3261-30cb-4ffa-8b0e-501ae0eaa254",
      "code": "91",
      "personal_info": {
        "first_name": "LATA",
        "last_name": "Bhongir",
        "name": "LATA Bhongir",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "e3b5efed-4d25-456d-a748-184a6f4b9694",
        "name": "Beauty Therapist"
      }
    },
    {
      "id": "777c39b2-bff5-4f99-be6c-6a615a5af90d",
      "code": "EMP11607",
      "personal_info": {
        "first_name": "Mamta",
        "last_name": "Gupta",
        "name": "Mamta Gupta",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "68d9a070-46af-486c-a0e3-efd1b756eb3e",
      "code": "EMP02287",
      "personal_info": {
        "first_name": "Manoj",
        "last_name": "Juya",
        "name": "Manoj Juya",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "b9c50bca-4081-4aac-860c-0badb103f45d",
      "code": "024",
      "personal_info": {
        "first_name": "Meena",
        "last_name": "Nandan",
        "name": "Meena Nandan",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "1737875d-f3c1-4737-9d54-2867898bc64d",
        "name": "Nurse"
      }
    },
    {
      "id": "81c15105-93d5-48a7-a604-29d2bdbc9310",
      "code": "EMP02304",
      "personal_info": {
        "first_name": "Meera",
        "last_name": "Bajaj",
        "name": "Meera Bajaj",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "e3b5efed-4d25-456d-a748-184a6f4b9694",
        "name": "Beauty Therapist"
      }
    },
    {
      "id": "f0124b6b-c370-42f0-96e0-8ce92885dc52",
      "code": "143",
      "personal_info": {
        "first_name": "Mohammad",
        "last_name": "Azeem",
        "name": "Mohammad Azeem",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "692f6e09-becc-49ac-8550-dc2b5b769f85",
      "code": "101",
      "personal_info": {
        "first_name": "Mohd.",
        "last_name": "Faisal",
        "name": "Mohd. Faisal",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "25eede52-c387-4c83-ae92-ce4192fab833",
      "code": "EMP02295",
      "personal_info": {
        "first_name": "Naresh",
        "last_name": "Thakur",
        "name": "Naresh Thakur",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "13b01732-d952-404b-aa23-22b1dd468d0b",
        "name": "Hair Stylist"
      }
    },
    {
      "id": "8f53722c-b54c-4fa1-9dcc-a17e5eba1984",
      "code": "EMP12080",
      "personal_info": {
        "first_name": "Nidhi",
        "last_name": "Bhullar",
        "name": "Nidhi Bhullar",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "ba6b4137-2672-41fa-bd94-13700951b5eb",
      "code": "85",
      "personal_info": {
        "first_name": "Niharika",
        "last_name": "Ray",
        "name": "Niharika Ray",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "9edb22fa-4c5d-44a5-881d-3364b072ae30",
      "code": "EMP13822",
      "personal_info": {
        "first_name": "Nisha",
        "last_name": "Prem",
        "name": "Nisha Prem",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "cc63f45c-8451-420f-abc4-0c675d2689fd",
      "code": "96",
      "personal_info": {
        "first_name": "NUPUR",
        "last_name": "DAWAR",
        "name": "NUPUR DAWAR",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0af497cb-554c-4297-9fd9-e8150840a7cd",
        "name": "Beauty Incharge"
      }
    },
    {
      "id": "6013b423-d329-49d2-9cb7-93cdeba86949",
      "code": "032",
      "personal_info": {
        "first_name": "Nutan",
        "last_name": "Singh",
        "name": "Nutan Singh",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "3347b6c4-4bcf-4ecc-954f-8568f2ce9874",
      "code": "EMP13604",
      "personal_info": {
        "first_name": "Pooja",
        "last_name": "Jwala",
        "name": "Pooja Jwala",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "2cafbb4c-b38e-4a35-ae60-a2cbd0c64852",
      "code": "EMP08650",
      "personal_info": {
        "first_name": "Poonam",
        "last_name": "Singh",
        "name": "Poonam Singh",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "e3b5efed-4d25-456d-a748-184a6f4b9694",
        "name": "Beauty Therapist"
      }
    },
    {
      "id": "3d0075b7-e94a-418c-98aa-d616b779846a",
      "code": "64",
      "personal_info": {
        "first_name": "PUSHPA",
        "last_name": "Zareen",
        "name": "PUSHPA Zareen",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0e47d7cd-15b1-4e4b-bbdd-9db7dc8b02af",
        "name": "Masseur"
      }
    },
    {
      "id": "f68abb64-55ae-4d5e-b525-0e16e8b36e33",
      "code": "99",
      "personal_info": {
        "first_name": "RAHUL",
        "last_name": "Goud",
        "name": "RAHUL Goud",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0e47d7cd-15b1-4e4b-bbdd-9db7dc8b02af",
        "name": "Masseur"
      }
    },
    {
      "id": "356fc72f-dd2a-4c62-966b-df47dac4d3cb",
      "code": "22",
      "personal_info": {
        "first_name": "Rahul",
        "last_name": "Singh",
        "name": "Rahul Singh",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "54cb0d10-b473-4d4f-ad55-737934315408",
        "name": "Make Up Artist"
      }
    },
    {
      "id": "3954ecee-0d87-428c-8aee-c9787bbe8ec8",
      "code": "EMP13603",
      "personal_info": {
        "first_name": "Raja",
        "last_name": "Sheikh",
        "name": "Raja Sheikh",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0910409a-b008-40b6-a031-ac2de77196ae",
        "name": "Pedicurist"
      }
    },
    {
      "id": "b217cf03-a1c7-4bef-8ff4-b156f26d304e",
      "code": "97",
      "personal_info": {
        "first_name": "RAJEEV",
        "last_name": "KUMAR",
        "name": "RAJEEV KUMAR",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0910409a-b008-40b6-a031-ac2de77196ae",
        "name": "Pedicurist"
      }
    },
    {
      "id": "8f76ae33-3c6c-40ca-8ada-0f37128e7e04",
      "code": "114",
      "personal_info": {
        "first_name": "Rama",
        "last_name": "Aggarwal",
        "name": "Rama Aggarwal",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "caa9059d-400a-4231-94d0-c349a76a5f92",
        "name": "Beauty Manager"
      }
    },
    {
      "id": "3fd23693-7579-4143-9fed-dfb7fe5648fd",
      "code": "130",
      "personal_info": {
        "first_name": "Rani",
        "last_name": "Devi",
        "name": "Rani Devi",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "56043203-5510-4158-8e4a-0d8523e538f7",
      "code": "124",
      "personal_info": {
        "first_name": "Rashmi",
        "last_name": "Kumari",
        "name": "Rashmi Kumari",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "58178d93-6198-4d15-a282-c42c6a11e97d",
      "code": "138",
      "personal_info": {
        "first_name": "Razni",
        "last_name": "Rana",
        "name": "Razni Rana",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "845a6db0-0af2-4060-9680-a5336b63f675",
      "code": "29",
      "personal_info": {
        "first_name": "RECEIP",
        "last_name": "Two",
        "name": "RECEIP Two",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "753bf577-a0be-427f-b930-a4852a84ab4e",
      "code": "107",
      "personal_info": {
        "first_name": "Reena",
        "last_name": "Thomas",
        "name": "Reena Thomas",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "c0c96fc7-2111-46ac-9a33-500ac903a13a",
      "code": "033",
      "personal_info": {
        "first_name": "RENU",
        "last_name": "KAPOOR",
        "name": "RENU KAPOOR",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "aacf1d0d-abb9-41af-b44a-eb2de9f9d207",
        "name": "Skin Therapist"
      }
    },
    {
      "id": "ec9bb210-3f5a-488b-b569-f5d62e75cde1",
      "code": "023",
      "personal_info": {
        "first_name": "ROZA",
        "last_name": "DIXIT",
        "name": "ROZA DIXIT",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "1737875d-f3c1-4737-9d54-2867898bc64d",
        "name": "Nurse"
      }
    },
    {
      "id": "80ea8a41-6cf4-4440-8341-e733f168b7e1",
      "code": "84",
      "personal_info": {
        "first_name": "Ruchi",
        "last_name": "Khera",
        "name": "Ruchi Khera",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0af497cb-554c-4297-9fd9-e8150840a7cd",
        "name": "Beauty Incharge"
      }
    },
    {
      "id": "30c3c23a-1f7c-4f06-82f8-7e1e486a3533",
      "code": "141",
      "personal_info": {
        "first_name": "Saloni",
        "last_name": "Rani",
        "name": "Saloni Rani",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "7bb0e02d-7c79-44a7-96c7-be0d2ee48c15",
        "name": "Physioptherapist"
      }
    },
    {
      "id": "69fc754d-9cb3-4ca2-a9ca-0bc4a3d8b232",
      "code": "EMP11152",
      "personal_info": {
        "first_name": "Sandeep",
        "last_name": "Pandey",
        "name": "Sandeep Pandey",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "e3b5efed-4d25-456d-a748-184a6f4b9694",
        "name": "Beauty Therapist"
      }
    },
    {
      "id": "f37cfefc-44ef-44a8-b837-2a842fedd5cd",
      "code": "72",
      "personal_info": {
        "first_name": "SANJEEV",
        "last_name": "KUMAR SINGH",
        "name": "SANJEEV KUMAR SINGH",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "6d62ce81-4bc4-467f-ab45-6229c3a662c5",
      "code": "EMP10570",
      "personal_info": {
        "first_name": "Sarala",
        "last_name": "T",
        "name": "Sarala T",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "e3b5efed-4d25-456d-a748-184a6f4b9694",
        "name": "Beauty Therapist"
      }
    },
    {
      "id": "397b7537-9f4a-430b-ac56-35086eebbdec",
      "code": "EMP12837",
      "personal_info": {
        "first_name": "Sawan",
        "last_name": "Jahan",
        "name": "Sawan Jahan",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "c11fdd11-cc24-440e-892b-555ea545bea7",
      "code": "009",
      "personal_info": {
        "first_name": "Shadab",
        "last_name": "Azim",
        "name": "Shadab Azim",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "54cb0d10-b473-4d4f-ad55-737934315408",
        "name": "Make Up Artist"
      }
    },
    {
      "id": "006dd44b-ef2d-4b35-a605-828187dcd895",
      "code": "71",
      "personal_info": {
        "first_name": "Shahid",
        "last_name": "Ali",
        "name": "Shahid Ali",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "91a647d2-6083-4e98-ae3b-290f85fd256f",
      "code": "EMP06382",
      "personal_info": {
        "first_name": "Shamim",
        "last_name": "Khan",
        "name": "Shamim Khan",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "e3b5efed-4d25-456d-a748-184a6f4b9694",
        "name": "Beauty Therapist"
      }
    },
    {
      "id": "62093ca4-3752-455d-be3d-89fe8e884c3b",
      "code": "136",
      "personal_info": {
        "first_name": "Shanti",
        "last_name": "Vilas",
        "name": "Shanti Vilas",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "f2878e4e-6a40-4f80-9f31-5be522674550",
      "code": "95",
      "personal_info": {
        "first_name": "SHASHI",
        "last_name": "Umed",
        "name": "SHASHI Umed",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "92613c04-82b2-41b8-807a-f06a81dffa18",
      "code": "81",
      "personal_info": {
        "first_name": "SHIKHA",
        "last_name": "Tandon",
        "name": "SHIKHA Tandon",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "be2bb9a1-6ea5-47d8-bc4f-a0ce367cd374",
      "code": "105",
      "personal_info": {
        "first_name": "Shipra",
        "last_name": "Shukla",
        "name": "Shipra Shukla",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "5155959a-ef2d-4a1f-8305-a25278a582c9",
      "code": "79",
      "personal_info": {
        "first_name": "SHRISTI",
        "last_name": "Dhar",
        "name": "SHRISTI Dhar",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "4833d833-3068-4c0a-87c4-0495aa871057",
        "name": "Beautician"
      }
    },
    {
      "id": "8cbd856f-a4ca-4dd3-914a-75f04444238d",
      "code": "88",
      "personal_info": {
        "first_name": "SHWETA",
        "last_name": "JAIN",
        "name": "SHWETA JAIN",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "ac1c5705-1ee6-4ba2-b029-a48465ccb691",
      "code": "83",
      "personal_info": {
        "first_name": "Simran",
        "last_name": "Rawat - emp07593",
        "name": "Simran Rawat - emp07593",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "4833d833-3068-4c0a-87c4-0495aa871057",
        "name": "Beautician"
      }
    },
    {
      "id": "fdbb626f-28f4-4099-8fd8-dfa0926f64c8",
      "code": "EMP07580",
      "personal_info": {
        "first_name": "Sonia",
        "last_name": "Verma-EMP07580",
        "name": "Sonia Verma-EMP07580",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0af497cb-554c-4297-9fd9-e8150840a7cd",
        "name": "Beauty Incharge"
      }
    },
    {
      "id": "68fa66c2-dc4b-455a-925c-e25fc8e6a159",
      "code": "EMP06743",
      "personal_info": {
        "first_name": "Sonu",
        "last_name": "Prasad-EMP06743",
        "name": "Sonu Prasad-EMP06743",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0910409a-b008-40b6-a031-ac2de77196ae",
        "name": "Pedicurist"
      }
    },
    {
      "id": "c703ea6c-d3a3-4dea-a875-4bf29d8301d7",
      "code": "86",
      "personal_info": {
        "first_name": "Sudha",
        "last_name": "Suman - EMP10431",
        "name": "Sudha Suman - EMP10431",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "0431f3ee-3cf9-4951-9217-fd7e5015d551",
      "code": "EMP02291",
      "personal_info": {
        "first_name": "Sunita",
        "last_name": "Rai-EMP02291",
        "name": "Sunita Rai-EMP02291",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "4833d833-3068-4c0a-87c4-0495aa871057",
        "name": "Beautician"
      }
    },
    {
      "id": "d08f2de1-52bf-42fa-93ff-cc3a49ef9b66",
      "code": "",
      "personal_info": {
        "first_name": "Surya Owner",
        "last_name": "A",
        "name": "Surya Owner A",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "84fce1b3-39a9-4d04-8f97-53d6e22ac4cf",
      "code": "2",
      "personal_info": {
        "first_name": "Surya",
        "last_name": "Teja",
        "name": "Surya Teja",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    },
    {
      "id": "21c319df-fd20-4272-9b95-ad1b36a0698d",
      "code": "RET00054",
      "personal_info": {
        "first_name": "Sushila",
        "last_name": "Jain-RET00054",
        "name": "Sushila Jain-RET00054",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "9dcb7ba0-3429-47dd-aabc-4db0b08d7aa8",
        "name": "Doctors"
      }
    },
    {
      "id": "f898f2dd-5905-4b8e-8f38-a9e717aad578",
      "code": "93",
      "personal_info": {
        "first_name": "SUYASH",
        "last_name": "SINGH",
        "name": "SUYASH SINGH",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0e16f6cc-e316-4c20-837b-fc95fe978315",
        "name": "Make Up Manager"
      }
    },
    {
      "id": "c8c1de8c-0274-4a4e-a0dd-d3c30418a28b",
      "code": "127",
      "personal_info": {
        "first_name": "Swapnali",
        "last_name": "Chaugule",
        "name": "Swapnali Chaugule",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "43844cc8-e99a-4041-8f6f-e2ba3561c444",
      "code": "123",
      "personal_info": {
        "first_name": "Tarej",
        "last_name": "Sneh Lata",
        "name": "Tarej Sneh Lata",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "2d543e2f-15cf-4670-bbb1-55431340e7d0",
      "code": "98",
      "personal_info": {
        "first_name": "UMA",
        "last_name": "SHARMA",
        "name": "UMA SHARMA",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0af497cb-554c-4297-9fd9-e8150840a7cd",
        "name": "Beauty Incharge"
      }
    },
    {
      "id": "060e17a7-ce4f-4a54-b80a-b124be1fdd10",
      "code": "62",
      "personal_info": {
        "first_name": "Uzma",
        "last_name": "Fauzan",
        "name": "Uzma Fauzan",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "49487bbb-b1fd-403c-9289-672b48c0f2f4",
      "code": "129",
      "personal_info": {
        "first_name": "Uzma",
        "last_name": "Khan",
        "name": "Uzma Khan",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "5ed7c2fb-8fcd-4a8b-80c2-48421fc87f5a",
      "code": "125",
      "personal_info": {
        "first_name": "Vejata",
        "last_name": "Kumar - EMP12078",
        "name": "Vejata Kumar - EMP12078",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "cdde86e3-ee36-4df9-9b3a-02c994861aa1",
        "name": "Slimming Therpist"
      }
    },
    {
      "id": "7246f2f9-210f-400c-871f-c90d8a3af52d",
      "code": "10",
      "personal_info": {
        "first_name": "Vibha",
        "last_name": "Vats",
        "name": "Vibha Vats",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "1c38f68f-40e8-44eb-874f-de7674c04f68",
      "code": "EMP12961",
      "personal_info": {
        "first_name": "Vinita",
        "last_name": "Kochhar-EMP12961",
        "name": "Vinita Kochhar-EMP12961",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "0ed1f692-8b4a-4978-b7e4-a8ba39ab4d9b",
        "name": "Dietician"
      }
    },
    {
      "id": "1c10ff97-4528-43e8-af38-473cebe3944c",
      "code": "87",
      "personal_info": {
        "first_name": "Waseem",
        "last_name": "Ahmed - EMP08774",
        "name": "Waseem Ahmed - EMP08774",
        "nick_name": "",
        "gender": "1"
      },
      "job_info": {
        "id": "13b01732-d952-404b-aa23-22b1dd468d0b",
        "name": "Hair Stylist"
      }
    },
    {
      "id": "5596aaba-5d0e-4e73-abea-bcb911505ad8",
      "code": "EMP13098",
      "personal_info": {
        "first_name": "Yukti",
        "last_name": "Sharma",
        "name": "Yukti Sharma",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "7bb0e02d-7c79-44a7-96c7-be0d2ee48c15",
        "name": "Physioptherapist"
      }
    },
    {
      "id": "5f233730-1b43-4b8e-a512-0e0e7483661c",
      "code": "3",
      "personal_info": {
        "first_name": "李泰国李泰国李泰国李泰国",
        "last_name": "李泰国李泰国李泰国李泰国",
        "name": "李泰国李泰国李泰国李泰国 李泰国李泰国李泰国李泰国",
        "nick_name": "",
        "gender": "0"
      },
      "job_info": {
        "id": "b15b8c00-3dbc-495c-9b4a-f0cb3960bbe8",
        "name": "Hair Dresser"
      }
    }
  ]
}




GET https://api.zenoti.com/v1/Centers/{center_id}/services
Request
const options = {
  method: 'GET',
  headers: {accept: 'application/json', Authorization: 'apikey <your api key>'}
};

fetch('https://api.zenoti.com/v1/Centers/center_id/services?page=1&size=10', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
{
  "id": "55265b47-ad10-4ee6-8883-ff198c5dc433",
  "code": "LS1066",
  "name": "Acrylic -  Natural Full Set Extension",
  "description": "",
  "duration": 90,
  "recovery_time": 0,
  "price_info": {
    "currency_id": 147,
    "sale_price": 310,
    "tax_id": "ebabf80f-ac9b-4270-b0b4-fca8cb0e2627",
    "ssg": 0,
    "include_tax": false,
    "demand_group_id": ""
  },
  "additional_info": {
    "html_description": "",
    "category": {
      "id": "9b2ce954-2a44-4775-9154-e226e8786bd9",
      "name": "Hands And Feet"
    },
    "sub_category": {
      "id": "b8cc59f6-e7dc-44e1-a6ce-104ef05aa58c",
      "name": "Nail Extension"
    },
    "bussiness_unit": {
      "id": "0ab7513c-82d6-4e0c-99db-12d52852db91",
      "name": "Female"
    }
  },
  "catalog_info": {
    "show_in_catalog": true,
    "can_book": true,
    "show_price": true,
    "display_name": "",
    "display_price": "",
    "display_order": "",
    "video_url": ""
  },
  "variants_info": {
    "is_variant": false,
    "has_variant": false
  },
  "add_ons_info": {
    "is_add_on": false,
    "has_add_ons": false,
    "add_ons_list": null
  },
  "image_paths": null
}




GET https://api.zenoti.com/v1/centers/{center_id}/packages
Request 
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/centers/center_id/packages?page=1&size=10', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
{
  "packages": [
    {
      "id": "960c75ea-e632-45fd-ba11-a5566cb6acda",
      "code": "bp1",
      "name": "belu pack1",
      "description": "belu pack1",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "0b5d4cbc-2065-48b0-ad4f-4828633c055b",
      "html_description": "belu+pack1",
      "time": 15,
      "booking_start_date": "2017-03-21T00:00:00",
      "booking_end_date": "2020-03-01T00:00:00",
      "commission": {
        "eligible": true,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "belu pack1 - web",
        "display_price": "100",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": [
          {
            "id": "6f7c8b4c-4344-4375-8af5-a0ecc673d568",
            "item_type": 2,
            "quantity": 3,
            "order": -1,
            "recognize_revenue": true
          }
        ],
        "products": [],
        "bundled_products": []
      }
    },
    {
      "id": "03680053-641d-4bb6-b2b2-45ea2f9a6148",
      "code": "bsp1",
      "name": "belu services pack1",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "cc2e938a-4a1a-46ac-93d4-5ef6a64fe621",
      "html_description": "",
      "time": 0,
      "booking_start_date": "2017-03-21T00:00:00",
      "booking_end_date": "2018-03-21T00:00:00",
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": false,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "belu services pack1",
        "display_price": "100",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": null,
        "products": null,
        "bundled_products": null
      }
    },
    {
      "id": "2233dd3d-ab59-4d94-93db-25e429798a16",
      "code": "PK9",
      "name": "Beluga HF Class Service",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "97f74c82-7049-4933-ae5c-fdccb7808f82",
      "html_description": "",
      "time": 15,
      "booking_start_date": null,
      "booking_end_date": null,
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": false,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": null,
        "products": null,
        "bundled_products": null
      }
    },
    {
      "id": "254825be-29ce-42a7-b6f9-2386d329a0ab",
      "code": "pk99",
      "name": "Beluga HF Class_New",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "4ca64bb4-f735-4961-a542-a3789b0a5093",
      "html_description": "",
      "time": 0,
      "booking_start_date": null,
      "booking_end_date": null,
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": null,
        "products": null,
        "bundled_products": null
      }
    },
    {
      "id": "87298ddf-5379-4290-b62a-98066b89c3bb",
      "code": "pk999",
      "name": "Beluga HF Service",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "6a3fa27c-75ea-467b-8c4c-d5f5594ff0ee",
      "html_description": "",
      "time": 0,
      "booking_start_date": null,
      "booking_end_date": null,
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": false,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": null,
        "products": null,
        "bundled_products": null
      }
    },
    {
      "id": "bb9a5d22-6183-4cf1-894e-617d812b774e",
      "code": "PK9999",
      "name": "Beluga HF Service_NEW",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "92f11f96-4f26-4b70-8211-2091eb1cbe34",
      "html_description": "",
      "time": 15,
      "booking_start_date": "2018-11-01T00:00:00",
      "booking_end_date": "2018-11-21T00:00:00",
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": false,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": [
          {
            "id": "6f7c8b4c-4344-4375-8af5-a0ecc673d568",
            "item_type": 2,
            "quantity": 4,
            "order": -1,
            "recognize_revenue": true
          }
        ],
        "products": [],
        "bundled_products": []
      }
    },
    {
      "id": "1e2b0356-e610-421f-8eff-cea3bdd598e5",
      "code": "CP1",
      "name": "Class Package",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "7891eda0-c23b-479f-89bd-363043c6eacc",
      "html_description": "",
      "time": 0,
      "booking_start_date": null,
      "booking_end_date": null,
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 0,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": null,
        "products": null,
        "bundled_products": null
      }
    },
    {
      "id": "df0cda52-6f91-4083-9a65-466a4d4cd3c1",
      "code": "Day Pack",
      "name": "Day Pack",
      "description": "",
      "type": 1,
      "category_id": null,
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "df0cda52-6f91-4083-9a65-466a4d4cd3c1",
      "html_description": "",
      "time": 45,
      "booking_start_date": "2016-09-04T00:00:00",
      "booking_end_date": "2018-03-31T00:00:00",
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 1,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": true,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": [
          {
            "id": "f2448d01-5b55-43c1-85cd-39181411a2df",
            "item_type": 2,
            "quantity": 1,
            "order": 11,
            "recognize_revenue": true
          }
        ],
        "products": [],
        "bundled_products": []
      }
    },
    {
      "id": "d7af37a8-7b67-414f-8df3-cb65aee3564b",
      "code": "2",
      "name": "DaySlash",
      "description": "",
      "type": 1,
      "category_id": null,
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "d7af37a8-7b67-414f-8df3-cb65aee3564b",
      "html_description": "",
      "time": 15,
      "booking_start_date": null,
      "booking_end_date": null,
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": [
        "998cdf21-1886-4161-aa5c-79d9e5052c7e"
      ],
      "benefits": {
        "services": [
          {
            "id": "6f7c8b4c-4344-4375-8af5-a0ecc673d568",
            "item_type": 2,
            "quantity": 1,
            "order": -1,
            "recognize_revenue": true
          },
          {
            "id": "0d1a1625-ee1b-40b1-bc93-cd555423df25",
            "item_type": 2,
            "quantity": 1,
            "order": -1,
            "recognize_revenue": true
          }
        ],
        "products": [],
        "bundled_products": []
      }
    },
    {
      "id": "4e3a32f7-f36c-43f6-a996-562d6bced481",
      "code": "g1p1",
      "name": "Ger1 pack1",
      "description": "",
      "type": 2,
      "category_id": "1db904e6-71da-4911-9f11-ad4cfa0a060f",
      "Business_unit_id": "708fb934-4fa1-4e55-ab4d-21a083454893",
      "version_id": "3007a486-a882-4826-af79-5a6238564183",
      "html_description": "",
      "time": 0,
      "booking_start_date": "2017-05-01T00:00:00",
      "booking_end_date": "2017-05-05T00:00:00",
      "commission": {
        "eligible": false,
        "factor": 100,
        "type": 0,
        "value": 0
      },
      "preferences": {
        "allow_cancellation_fee": false,
        "allow_cancellation_comission": false,
        "allow_no_show_fee": false,
        "allow_no_show_comission": false,
        "allow_membership_redemption": false,
        "allow_giftcard_redemption": true,
        "enforce_otp": false
      },
      "catalog_info": {
        "show_in_catalog": true,
        "can_book": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "64b05ce4-ecfd-4478-bb42-b7378194bfa8",
          "currency_id": 61,
          "sale_price": 100,
          "tax_id": null,
          "auto_renewal": false
        }
      ],
      "tags": null,
      "benefits": {
        "services": null,
        "products": null,
        "bundled_products": null
      }
    }
  ],
  "page_info": {
    "total": 27,
    "page": 1,
    "size": 10
  }
}



GET  https://api.zenoti.com/v1/centers/{center_id}/products
Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/centers/center_id/products?page=1&size=10', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "products": [
    {
      "id": "fb604f5d-bc3a-45c9-816b-0f214b69bd69",
      "code": "002003",
      "name": "Body Icing Inclusive",
      "description": "",
      "html_description": "",
      "category_id": "7779e4f2-dfa6-4b8c-b296-126c6ce15b6d",
      "sub_category_id": "93748cc4-b3a2-4234-a407-7cecf38314b3",
      "bussiness_unit_id": "2bea39e4-e57a-4fb9-87af-f9e9721488e5",
      "quantity": {
        "value": 1000,
        "unit": "ml"
      },
      "commission": {
        "eligible": true,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": true,
        "retail": true
      },
      "barcodes": [
        {
          "value": "00P003",
          "is_primary": false
        },
        {
          "value": "P003",
          "is_primary": true
        },
        {
          "value": "002003",
          "is_primary": false
        }
      ],
      "tags": [
        "036fae06-6455-46ae-9c4a-028b7d1d8844",
        "52477082-83cb-4515-811a-043633aba0ee",
        "1c89969b-6dcf-4619-bdeb-12566bdd3f48",
        "bd3fbf45-2e8a-4ef9-b74e-1ab0d998c816",
        "d880608c-19d2-4fee-881d-1fb3111b330f",
        "1e14fd6d-5c15-4332-867c-296dfb7ff4ec",
        "d8d5c8da-a19a-45a5-8dbb-2e94ef0892c0",
        "f06124a2-37b2-4827-9728-32f9399e4433",
        "d276ea96-cc0a-43dc-9643-3f09cbee3400",
        "ea250d8c-6271-49ac-b209-49d8c745fd35",
        "7df3f469-334c-48f0-87e7-4a49c06e3dea",
        "a6d8f1b8-01b4-4a77-aa38-4cbce7d9f034",
        "67a17942-44a2-45fe-a3b4-4d5d1f32c11f",
        "b3238276-42e0-4e0e-bf91-549c0b87cb6d",
        "55e43c69-636c-4e64-a19d-59326aa3e220",
        "85acbe89-0394-4193-85f8-59c0092500b1",
        "450e60d7-4c60-4bde-936c-59fd56516b21",
        "0d81986d-8474-463d-b392-638a47e5dff9",
        "16690591-4fb0-4ede-a6b8-706c445d8358",
        "370219e3-08dd-4b48-bf35-756fdb8fe218",
        "c23a75e9-bbae-4b38-9500-7bc91b7398e4",
        "d8971bb1-d793-4b37-98ab-b1bd7e8c7e1c",
        "07080c2a-7890-4700-8a31-bf672f2862d3",
        "653f44b5-24fc-445e-b499-c2164619e9f6",
        "5ae627be-2cf6-4a20-8bf9-c2e677616ca2",
        "ef1de686-67ff-4e69-9a23-cf9a9c17e2e6",
        "d1df6dc3-8baf-42a7-b2f0-d3edaf0b473e",
        "74d80769-567d-4896-af2d-d86f74491fa5",
        "42a7ee50-56df-4556-8f73-ecd234c228fb",
        "b0da7dce-b487-4c86-a65f-ee01ca9fc1a1"
      ],
      "catalog_info": {
        "show_in_catalog": true,
        "show_price": false,
        "display_name": "@#%&()_+-}{[]',./",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": true,
            "tax_id": "a3ace661-6102-44aa-9888-204dc7b59bfa",
            "sale_price": 1500
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": "f82482dc-bf92-460d-acb6-1cdc1861d113",
            "order": 0
          }
        }
      ]
    },
    {
      "id": "e763a70f-40f3-49fb-a606-92c703da132f",
      "code": "P018",
      "name": "Body Lotion - Gel",
      "description": "",
      "html_description": "",
      "category_id": "9d8b6ba9-22c2-4ffe-92cb-ed3307b2910e",
      "sub_category_id": "cc46b878-b4ea-4e81-9268-c0e348e43005",
      "bussiness_unit_id": "25ba58cf-1558-4b97-8c40-852d12944525",
      "quantity": {
        "value": 10,
        "unit": "gms"
      },
      "commission": {
        "eligible": true,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": true,
        "retail": true
      },
      "barcodes": [
        {
          "value": "P018",
          "is_primary": true
        },
        {
          "value": "123456789012",
          "is_primary": false
        },
        {
          "value": "042100005264",
          "is_primary": false
        }
      ],
      "tags": null,
      "catalog_info": {
        "show_in_catalog": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": true,
            "tax_id": "a3ace661-6102-44aa-9888-204dc7b59bfa",
            "sale_price": 2000
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "9ac8a678-3b3e-456a-8832-653bab7b5ccb",
      "code": "P019",
      "name": "Body Lotion - Glycerin",
      "description": "",
      "html_description": "",
      "category_id": "9d8b6ba9-22c2-4ffe-92cb-ed3307b2910e",
      "sub_category_id": "cc46b878-b4ea-4e81-9268-c0e348e43005",
      "bussiness_unit_id": "25ba58cf-1558-4b97-8c40-852d12944525",
      "quantity": {
        "value": 50,
        "unit": "gms"
      },
      "commission": {
        "eligible": true,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": true,
        "retail": true
      },
      "barcodes": [
        {
          "value": "P019",
          "is_primary": true
        }
      ],
      "tags": null,
      "catalog_info": {
        "show_in_catalog": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": false,
            "tax_id": "a3ace661-6102-44aa-9888-204dc7b59bfa",
            "sale_price": 2500
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "07b891b1-d7eb-438d-bff4-28e63452b246",
      "code": "P009",
      "name": "Body Lotion Exclusive",
      "description": "",
      "html_description": "",
      "category_id": "7779e4f2-dfa6-4b8c-b296-126c6ce15b6d",
      "sub_category_id": "93748cc4-b3a2-4234-a407-7cecf38314b3",
      "bussiness_unit_id": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
      "quantity": {
        "value": 100,
        "unit": "cm"
      },
      "commission": {
        "eligible": true,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": true,
        "retail": true
      },
      "barcodes": [
        {
          "value": "P009",
          "is_primary": true
        }
      ],
      "tags": [
        "49527c2d-43c9-4d58-97a2-ba0c2cf33004"
      ],
      "catalog_info": {
        "show_in_catalog": true,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": "w2JuRVG47R8"
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": true,
            "tax_id": "a3ace661-6102-44aa-9888-204dc7b59bfa",
            "sale_price": 5000
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "43a62c39-11ff-4b55-879c-2d18c0c6af62",
      "code": "P002",
      "name": "Body Moisturizer",
      "description": "",
      "html_description": "",
      "category_id": "7779e4f2-dfa6-4b8c-b296-126c6ce15b6d",
      "sub_category_id": "93748cc4-b3a2-4234-a407-7cecf38314b3",
      "bussiness_unit_id": "2bea39e4-e57a-4fb9-87af-f9e9721488e5",
      "quantity": {
        "value": 50,
        "unit": "ml"
      },
      "commission": {
        "eligible": true,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": true,
        "retail": true
      },
      "barcodes": [
        {
          "value": "P002",
          "is_primary": true
        }
      ],
      "tags": [
        "49527c2d-43c9-4d58-97a2-ba0c2cf33004"
      ],
      "catalog_info": {
        "show_in_catalog": true,
        "show_price": false,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": false,
            "tax_id": "a3ace661-6102-44aa-9888-204dc7b59bfa",
            "sale_price": 90000
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "5d2b3c85-9332-49d4-99d4-ad0aac13a6cc",
      "code": "C01",
      "name": "Cleanser-1",
      "description": "",
      "html_description": "",
      "category_id": "4782722c-a9a2-4e91-aece-4705faaea1e8",
      "sub_category_id": "d3195acf-eea6-4ae8-8f76-b36b31ca2920",
      "bussiness_unit_id": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
      "quantity": {
        "value": 1,
        "unit": "cm"
      },
      "commission": {
        "eligible": false,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": false,
        "retail": true
      },
      "barcodes": [
        {
          "value": "C01",
          "is_primary": true
        }
      ],
      "tags": null,
      "catalog_info": {
        "show_in_catalog": false,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": false,
            "tax_id": null,
            "sale_price": 11
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "fe1c2830-3381-4147-b64a-45ed0b379b87",
      "code": "C02",
      "name": "Cleanser-2",
      "description": "",
      "html_description": "",
      "category_id": "4782722c-a9a2-4e91-aece-4705faaea1e8",
      "sub_category_id": "d3195acf-eea6-4ae8-8f76-b36b31ca2920",
      "bussiness_unit_id": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
      "quantity": {
        "value": 1,
        "unit": "cm"
      },
      "commission": {
        "eligible": false,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": false,
        "retail": true
      },
      "barcodes": [
        {
          "value": "C02",
          "is_primary": true
        }
      ],
      "tags": null,
      "catalog_info": {
        "show_in_catalog": false,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": false,
            "tax_id": null,
            "sale_price": 2
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "618c9d0c-431a-47af-bc9f-6f34a8995485",
      "code": "C03",
      "name": "Conditioner-1",
      "description": "",
      "html_description": "",
      "category_id": "4782722c-a9a2-4e91-aece-4705faaea1e8",
      "sub_category_id": "c626ddc6-be1b-443d-beda-86857cc1e683",
      "bussiness_unit_id": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
      "quantity": {
        "value": 1,
        "unit": "cm"
      },
      "commission": {
        "eligible": false,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": false,
        "retail": true
      },
      "barcodes": [
        {
          "value": "C03",
          "is_primary": true
        }
      ],
      "tags": null,
      "catalog_info": {
        "show_in_catalog": false,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": false,
            "tax_id": null,
            "sale_price": 10
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    },
    {
      "id": "2b96922a-af58-470e-8e22-4972c3fb6875",
      "code": "C04",
      "name": "Conditioner-2",
      "description": "",
      "html_description": "",
      "category_id": "4782722c-a9a2-4e91-aece-4705faaea1e8",
      "sub_category_id": "c626ddc6-be1b-443d-beda-86857cc1e683",
      "bussiness_unit_id": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
      "quantity": {
        "value": 1,
        "unit": "cm"
      },
      "commission": {
        "eligible": false,
        "factor": 0,
        "type": 0,
        "value": 100
      },
      "preferences": {
        "consumable": false,
        "retail": true
      },
      "barcodes": [
        {
          "value": "C04",
          "is_primary": true
        }
      ],
      "tags": null,
      "catalog_info": {
        "show_in_catalog": false,
        "show_price": true,
        "display_name": "",
        "display_price": "",
        "video_url": ""
      },
      "centers": [
        {
          "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
          "center_code": "CHN",
          "sale_info": {
            "currency_id": 148,
            "include_tax": false,
            "tax_id": null,
            "sale_price": 20
          },
          "inventory_info": {
            "desired_quantity": 0,
            "alert_quantity": 0,
            "transfer_price": 0,
            "transfer_tax_id": null,
            "order": 0
          }
        }
      ]
    }
  ],
  "page_info": {
    "total": 27,
    "page": 1,
    "size": 10
  }
}


POST https://api.zenoti.com/v1/guests
Request
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "id": "7ffbeb62-efd0-435c-b98b-2475c311868b",
  "code": "",
  "center_id": "b5ed4fbb-4c05-4195-b313-1320b620224b",
  "personal_info": {
    "user_name": "",
    "first_name": "abcd",
    "last_name": "efgh",
    "middle_name": "",
    "email": "",
    "mobile_phone": {
      "country_code": 95,
      "number": "7777788888"
    },
    "work_phone": null,
    "home_phone": null,
    "gender": 0,
    "date_of_birth": "0001-01-01T00:00:00",
    "is_minor": false,
    "nationality_id": -1,
    "anniversary_date": "0001-01-01T00:00:00",
    "lock_guest_custom_data": false,
    "pan": ""
  },
  "address_info": {
    "address_1": "",
    "address_2": "",
    "city": "",
    "country_id": -1,
    "state_id": -1,
    "state_other": "",
    "zip_code": ""
  },
  "preferences": {
    "receive_transactional_email": false,
    "receive_transactional_sms": false,
    "receive_marketing_email": false,
    "receive_marketing_sms": false,
    "recieve_lp_stmt": true,
    "preferred_therapist": null
  },
  "tags": null,
  "referral": null,
  "primary_employee": null
}


GET
https://api.zenoti.com/v1/guests/{guest_id}

Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/guest_id', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "id": "4261fadb-f00c-4d3d-a9c4-898cbfc221dc",
  "code": "",
  "center_id": "b5ed4fbb-4c05-4195-b313-1320b620224b",
  "personal_info": {
    "user_name": "john.leone",
    "first_name": "John",
    "last_name": "Leone",
    "middle_name": "Ashley",
    "email": "john.leone@gmail.com",
    "mobile_phone": {
      "country_code": 225,
      "number": "9104874674"
    },
    "work_phone": {
      "country_code": 225,
      "number": "9104874674"
    },
    "home_phone": {
      "country_code": 225,
      "number": "9104874675"
    },
    "gender": 1,
    "date_of_birth": "1997-08-02T00:00:00",
    "is_minor": false,
    "nationality_id": 225,
    "anniversary_date": "2018-11-06T00:00:00",
    "lock_guest_custom_data": false,
    "pan": ""
  },
  "address_info": {
    "address_1": "4462 Dove Dr",
    "address_2": "Beale Afb",
    "city": "California",
    "country_id": 225,
    "state_id": 40,
    "state_other": "CA",
    "zip_code": "95903"
  },
  "preferences": {
    "receive_transactional_email": true,
    "receive_transactional_sms": true,
    "receive_marketing_email": true,
    "receive_marketing_sms": true,
    "recieve_lp_stmt": true,
    "preferred_therapist": {
      "id": "4a98db4c-8424-466e-97f8-2e54d529fdbd",
      "name": "Amanda"
    }
  },
  "tags": [
    "CHECKED_IN",
    "Most Valuable Guest"
  ],
  "referral": {
    "referral_source": {
      "id": "57cdad4d-7045-40b3-885b-d0c191c75113",
      "name": "Mike
    },
    "referred_by": {
      "id": "02be89a4-1250-45a6-80a1-34b286e68228",
      "name": "Sandy"
    }
  },
  "primary_employee": {
    "id": "4a98db4c-8424-466e-97f8-2e54d529fdbd",
    "name": "Amanda"
  }
}


GET https://api.zenoti.com/v1/guests/search?center_id={center_id}&first_name={first_name}&last_name={last_name}&zip_code={zip_code}&phone={phone}&tags={tags}&user_name={user_name}&user_code={user_code}&email={user_email}

Request 
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/search?page=1&size=10&center_id=center_id&first_name=first_name&last_name=last_name&zip_code=zip_code&phone=phone&tags=tags&user_name=user_name&user_code=user_code&email=user_email', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
{
  "guests": [
    {
      "id": "A9996495-6BCD-415A-ADB1-052353D9EF9F",
      "code": "",
      "center_id": "b5ed4fbb-4c05-4195-b313-1320b620224b",
      "personal_info": {
        "user_name": "simonsimu",
        "first_name": "simon",
        "last_name": "simon",
        "middle_name": "simon",
        "email": "simon@simon.com",
        "mobile_phone": {
          "country_code": 95,
          "number": "7777799988"
        },
        "work_phone": {
          "country_code": 95,
          "number": "7777799999"
        },
        "home_phone": {
          "country_code": 95,
          "number": "7777799999"
        },
        "gender": 1,
        "date_of_birth": "1997-08-02T00:00:00",
        "is_minor": false,
        "nationality_id": 95,
        "anniversary_date": "2018-11-06T00:00:00",
        "lock_guest_custom_data": false,
        "pan": ""
      },
      "address_info": {
        "address_1": "aaaaaaaaa",
        "address_2": "bbbbbbbbb",
        "city": "cccccccccc",
        "country_id": 95,
        "state_id": -2,
        "state_other": "mystate",
        "zip_code": "502032"
      },
      "preferences": {
        "receive_transactional_email": true,
        "receive_transactional_sms": true,
        "receive_marketing_email": true,
        "receive_marketing_sms": true,
        "recieve_lp_stmt": true,
        "preferred_therapist": {
          "id": "4a98db4c-8424-466e-97f8-2e54d529fdbd",
          "name": "New Delhi_mgr mgr"
        }
      },
      "tags": [
        "CHECKED_IN",
        "MH",
        "Test"
      ],
      "referral": {
        "referral_source": {
          "id": "57cdad4d-7045-40b3-885b-d0c191c75113",
          "name": "Guest"
        },
        "referred_by": {
          "id": "02be89a4-1250-45a6-80a1-34b286e68228",
          "name": "Kirity Newdelhi"
        }
      },
      "primary_employee": {
        "id": "4a98db4c-8424-466e-97f8-2e54d529fdbd",
        "name": "New Delhi_mgr mgr"
      }
    }
  ]
}

GET https://api.zenoti.com/v1/guests/{guest_id}/appointments?page={page}&size={size}&start_date={start_date}&end_date={end_date}

Request 
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/guest_id/appointments?page=page&size=size&start_date=start_date&end_date=end_date', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "appointments": [
    {
      "appointment_group_id": "f4ffc350-f433-47be-bdee-6798bb5a5ebd",
      "no_of_guests": 1,
      "invoice_id": "f0d17b47-aee6-477d-ae92-e160280e8d89",
      "invoice_status": 4,
      "is_rebooking": true,
      "notes": null,
      "center_id": "03ff6a3b-0bf9-48b7-b01d-cc1a02cfa97c",
      "appointment_services": [
        {
          "appointment_id": "3a546747-4d2e-4c81-ab19-2ea1800d9567",
          "invoice_item_id": "a29a1373-a049-452f-aaae-7800fa26a0df",
          "cart_item_id": "88f95004-63d8-4d9d-af43-940d3a4cd5d0",
          "service": {
            "id": "2a4f932e-d3fd-41c8-9c4e-79cfb73e7413",
            "name": "Hair cut 1",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 0,
              "tax": 0,
              "final": 0
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-08-29T10:45:00",
          "end_time": "2019-08-29T11:15:00",
          "room": null,
          "equipment": null,
          "appointment_status": 1,
          "requested_therapist_id": "b171bef9-c73b-49ca-8e34-a67b32739ec9",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#0#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 0,
        "tax": 0,
        "final": 0
      },
      "group_invoice_id": null,
      "is_feedback_submitted": true
    },
    {
      "appointment_group_id": "4c550a84-0422-4e6e-a30d-191d47503f81",
      "no_of_guests": 1,
      "invoice_id": "379ab1c7-ecf0-449f-846f-72233e84de32",
      "invoice_status": 4,
      "is_rebooking": true,
      "notes": null,
      "center_id": "03ff6a3b-0bf9-48b7-b01d-cc1a02cfa97c",
      "appointment_services": [
        {
          "appointment_id": "0ffd4a9c-168a-435c-ae47-4fba5ed648fd",
          "invoice_item_id": "1447e688-33d6-4666-9f52-d15f39723031",
          "cart_item_id": "cd53caf1-700d-47cb-99d5-52f20dfde3f9",
          "service": {
            "id": "2a4f932e-d3fd-41c8-9c4e-79cfb73e7413",
            "name": "Hair cut 1",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 0,
              "tax": 0,
              "final": 0
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-08-29T11:15:00",
          "end_time": "2019-08-29T11:45:00",
          "room": null,
          "equipment": null,
          "appointment_status": 1,
          "requested_therapist_id": "b171bef9-c73b-49ca-8e34-a67b32739ec9",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#0#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 0,
        "tax": 0,
        "final": 0
      },
      "group_invoice_id": null,
      "is_feedback_submitted": true
    },
    {
      "appointment_group_id": "9f2189a8-5273-44da-9835-b793e57a61d1",
      "no_of_guests": 1,
      "invoice_id": "374e5b05-207e-4b1f-a8a0-6fe636a16267",
      "invoice_status": 4,
      "is_rebooking": false,
      "notes": null,
      "center_id": "03ff6a3b-0bf9-48b7-b01d-cc1a02cfa97c",
      "appointment_services": [
        {
          "appointment_id": "b68cec65-eeb4-4c42-9785-9ba0e0620397",
          "invoice_item_id": "352639d4-d4d5-441f-8539-5681ce6fd3ef",
          "cart_item_id": "7afa3417-5507-4b2c-a8af-67142a6256a0",
          "service": {
            "id": "2a4f932e-d3fd-41c8-9c4e-79cfb73e7413",
            "name": "Hair cut 1",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 0,
              "tax": 0,
              "final": 0
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-08-29T13:00:00",
          "end_time": "2019-08-29T13:30:00",
          "room": null,
          "equipment": null,
          "appointment_status": 1,
          "requested_therapist_id": "b171bef9-c73b-49ca-8e34-a67b32739ec9",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#0#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 0,
        "tax": 0,
        "final": 0
      },
      "group_invoice_id": null,
      "is_feedback_submitted": false
    },
    {
      "appointment_group_id": "0945fd68-061f-4591-8ae9-026d5138c2bd",
      "no_of_guests": 1,
      "invoice_id": "6cc293e3-902a-4375-b6c5-3bffcd99ec14",
      "invoice_status": 4,
      "is_rebooking": false,
      "notes": null,
      "center_id": "03ff6a3b-0bf9-48b7-b01d-cc1a02cfa97c",
      "appointment_services": [
        {
          "appointment_id": "7eef6727-f721-45c6-ab77-f9eb4a6ce1e9",
          "invoice_item_id": "fcb4fd10-2814-4032-9ee4-66e4437f2dea",
          "cart_item_id": "0f60efb4-5615-4bdb-ab99-136da256246b",
          "service": {
            "id": "54b119a5-e1f2-404b-bef1-c223fa0f2480",
            "name": "Service 1",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 100,
              "tax": 0,
              "final": 100
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-09-09T12:15:00",
          "end_time": "2019-09-09T12:45:00",
          "room": null,
          "equipment": null,
          "appointment_status": 1,
          "requested_therapist_id": "b171bef9-c73b-49ca-8e34-a67b32739ec9",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#0#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 100,
        "tax": 0,
        "final": 100
      },
      "group_invoice_id": null,
      "is_feedback_submitted": false
    },
    {
      "appointment_group_id": "0c8a8086-b129-45f2-b0d8-a0b894a0e9cc",
      "no_of_guests": 1,
      "invoice_id": "d37a2e63-8f54-4530-8dd4-048cb8146a42",
      "invoice_status": 4,
      "is_rebooking": false,
      "notes": null,
      "center_id": "03ff6a3b-0bf9-48b7-b01d-cc1a02cfa97c",
      "appointment_services": [
        {
          "appointment_id": "bd09fdaf-cdff-48ad-b845-28f02435e305",
          "invoice_item_id": "d3af78b0-182a-4f1c-8544-9467ffa99d23",
          "cart_item_id": null,
          "service": {
            "id": "54b119a5-e1f2-404b-bef1-c223fa0f2480",
            "name": "Service 1",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 100,
              "tax": 0,
              "final": 100
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-10-17T12:30:00",
          "end_time": "2019-10-17T13:00:00",
          "room": null,
          "equipment": null,
          "appointment_status": 1,
          "requested_therapist_id": "b171bef9-c73b-49ca-8e34-a67b32739ec9",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#0#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 100,
        "tax": 0,
        "final": 100
      },
      "group_invoice_id": null,
      "is_feedback_submitted": false
    },
    {
      "appointment_group_id": "d54c78b1-16d5-4413-b80b-533dd74ed646",
      "no_of_guests": 1,
      "invoice_id": "ba073997-4d9a-421d-99ee-c02a6ca52e83",
      "invoice_status": 0,
      "is_rebooking": false,
      "notes": null,
      "center_id": "a6e275f2-48ae-4a94-8223-8455ab14fb6e",
      "appointment_services": [
        {
          "appointment_id": "179aa60a-39ed-40ee-8910-9b9965a3b598",
          "invoice_item_id": "8b8f8b4d-b0c1-4760-86aa-90967d20195a",
          "cart_item_id": null,
          "service": {
            "id": "583692e0-1749-40ec-a74e-6566b24a350f",
            "name": "Service 2",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 36.35,
              "tax": 3.64,
              "final": 39.99
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-10-17T12:45:00",
          "end_time": "2019-10-17T13:15:00",
          "room": null,
          "equipment": null,
          "appointment_status": 0,
          "requested_therapist_id": "159130f0-7043-40b6-be8e-259104bfc7f4",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#1#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        },
        {
          "appointment_id": "7232526b-b9ec-47f6-be6b-8a2a4d27d808",
          "invoice_item_id": "b721eb22-29cb-4791-9bbb-78171a5c0216",
          "cart_item_id": null,
          "service": {
            "id": "ad154e46-fdc6-4b4b-a23f-58259480a410",
            "name": "Service 4",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 79.99,
              "tax": 8,
              "final": 87.99
            },
            "duration": 60,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-10-17T13:15:00",
          "end_time": "2019-10-17T14:15:00",
          "room": null,
          "equipment": null,
          "appointment_status": 0,
          "requested_therapist_id": "e018c9aa-9614-4e08-9541-3b880ca101a8",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#1#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 116.34,
        "tax": 11.64,
        "final": 127.98
      },
      "group_invoice_id": null,
      "is_feedback_submitted": false
    },
    {
      "appointment_group_id": "19d90362-a15d-4cd6-b342-f0e8c3efdc96",
      "no_of_guests": 1,
      "invoice_id": "f274d48a-4068-4d19-bb3a-6e8ed2bbb1dd",
      "invoice_status": 1,
      "is_rebooking": false,
      "notes": null,
      "center_id": "03ff6a3b-0bf9-48b7-b01d-cc1a02cfa97c",
      "appointment_services": [
        {
          "appointment_id": "994dab58-ec41-41d6-861a-bd403182eab4",
          "invoice_item_id": "e3cb3e69-9df9-4b30-b35f-69247be9f2dc",
          "cart_item_id": null,
          "service": {
            "id": "2a4f932e-d3fd-41c8-9c4e-79cfb73e7413",
            "name": "Hair cut 1",
            "display_name": null,
            "price": {
              "currency_id": 0,
              "sales": 0,
              "tax": 0,
              "final": 0
            },
            "duration": 30,
            "category_id": null,
            "is_addon": false,
            "has_addons": null,
            "addons": null,
            "is_variant": null,
            "has_variant": null,
            "parent_service_id": null
          },
          "requested_therapist_gender": 0,
          "start_time": "2019-11-11T10:15:00",
          "end_time": "2019-11-11T10:45:00",
          "room": null,
          "equipment": null,
          "appointment_status": 0,
          "requested_therapist_id": "b171bef9-c73b-49ca-8e34-a67b32739ec9",
          "quantity": 0,
          "service_custom_data_indicator": "1#1#0#0#0#1#0#0",
          "actual_start_time": null,
          "completed_time": null,
          "progress": 0,
          "parent_appointment_id": null,
          "service_custom_Data": null,
          "item_actions": "",
          "is_membership_applied": false,
          "is_addon": false,
          "addon_appointment_id": null,
          "has_service_form": true,
          "has_segments": false,
          "segments": null
        }
      ],
      "appointment_packages": [],
      "price": {
        "currency_id": 0,
        "sales": 0,
        "tax": 0,
        "final": 0
      },
      "group_invoice_id": null,
      "is_feedback_submitted": false
    }
  ],
  "page_info": {
    "total": 7,
    "page": 1,
    "size": 10
  }
}

GET https://api.zenoti.com/v1/guests/{guest_id}/products
Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/guest_id/products', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
{
  "products": [
    {
      "id": "c7436d09-799c-49ae-bcd9-b906c2c89fad",
      "name": "Aha Mask",
      "quantity": 1,
      "sale_by": "Abhishek owner",
      "sale_date": "2018-03-28T21:31:35",
      "price": 50,
      "discount": 0,
      "taxes": 0,
      "price_paid": 50,
      "promotion": null,
      "payment_type": "CC Online(Visa)",
      "invoice": {
        "id": "4152fd91-8ab1-471f-ae69-a7ff3b37460f",
        "source": 0,
        "status": "CLOSED",
        "invoice_number": "69153",
        "receipt_number": "R226",
        "invoice_item_id": "5554f247-28a9-49b3-90de-19953f262ad0"
      },
      "center": {
        "id": "08b5ff61-9cd4-49f8-9ed7-978b52161e89",
        "name": "Zenoti Mobile"
      }
    },
    {
      "id": "1dbed9bb-4450-49fc-9904-8208b7fa3bd3",
      "name": "Oil Slik Kit",
      "quantity": 5,
      "sale_by": "Andy Brown",
      "sale_date": "2017-08-02T23:44:09",
      "price": 775,
      "discount": 0,
      "taxes": 38.75,
      "price_paid": 0,
      "promotion": null,
      "payment_type": "",
      "invoice": {
        "id": "355b133a-7aff-40a4-bd01-70936fdf9c4f",
        "source": 0,
        "status": "OPEN",
        "invoice_number": "SGE2178",
        "receipt_number": "0",
        "invoice_item_id": "74af0273-e5de-405e-94bd-977b272fb8a6"
      },
      "center": {
        "id": "cab7edd3-d8e8-4c27-a36b-8aa16b8dbb4f",
        "name": "South Granville"
      }
    }
  ],
  "page_info": {
    "total": 20,
    "page": 1,
    "size": 2
  }
}


PUT https://api.zenoti.com/v1/guests/{guest_id}
Request 
const options = {
  method: 'PUT',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/guest_id', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "id": "4261fadb-f00c-4d3d-a9c4-898cbfc221dc",
  "code": "",
  "center_id": "b5ed4fbb-4c05-4195-b313-1320b620224b",
  "personal_info": {
    "user_name": "simonsimu",
    "first_name": "simon",
    "last_name": "simon",
    "middle_name": "simon",
    "email": "simon@simon.com",
    "mobile_phone": {
      "country_code": 95,
      "number": "7777799999"
    },
    "work_phone": {
      "country_code": 95,
      "number": "7777799999"
    },
    "home_phone": {
      "country_code": 95,
      "number": "7777799999"
    },
    "gender": 1,
    "date_of_birth": "1997-08-02T00:00:00",
    "is_minor": false,
    "nationality_id": 95,
    "anniversary_date": "2018-11-06T00:00:00",
    "lock_guest_custom_data": false,
    "pan": ""
  },
  "address_info": {
    "address_1": "aaaaaaaaa",
    "address_2": "bbbbbbbbb",
    "city": "cccccccccc",
    "country_id": 95,
    "state_id": -2,
    "state_other": "mystate",
    "zip_code": "502032"
  },
  "preferences": {
    "receive_transactional_email": true,
    "receive_transactional_sms": true,
    "receive_marketing_email": true,
    "receive_marketing_sms": true,
    "recieve_lp_stmt": true,
    "preferred_therapist": {
      "id": "4a98db4c-8424-466e-97f8-2e54d529fdbd",
      "name": "New Delhi_mgr mgr"
    }
  },
  "tags": [
    "CHECKED_IN",
    "MH Test"
  ],
  "referral": {
    "referral_source": {
      "id": "57cdad4d-7045-40b3-885b-d0c191c75113",
      "name": "Guest"
    },
    "referred_by": {
      "id": "02be89a4-1250-45a6-80a1-34b286e68228",
      "name": "Kirity Newdelhi"
    }
  },
  "primary_employee": {
    "id": "4a98db4c-8424-466e-97f8-2e54d529fdbd",
    "name": "New Delhi_mgr mgr"
  }
}


POST https://api.zenoti.com/v1/guests/{guest_id}/notes
Requests
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57/notes', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
{
  "id": "9805fb48-4c52-44fc-90da-66b1d063e8bb",
  "is_private": false,
  "alert": true,
  "note_type": 10,
  "notes": "Guest always prefer evening timings",
  "center": {
    "id": "c56f4e05-62b5-4033-b42e-b72db37722df",
    "name": "London"
  },
  "added_by": {
    "id": "c56f4e05-62b5-4033-b42e-b72db37722df",
    "name": "admin owner"
  },
  "created_date": "2018-12-20T11:06:57"
}


GET  https://api.zenoti.com/v1/guests/{guest_id}/notes/{note_id}
REquest
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57/notes/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "id": "5569e7f4-7710-4773-aeba-6f30c225f46f",
  "is_private": false,
  "alert": true,
  "note_type": 8,
  "notes": "sample string 4",
  "center": {
    "id": "c56f4e05-62b5-4033-b42e-b72db37722df",
    "name": "London"
  },
  "added_by": {
    "id": "",
    "name": ""
  },
  "created_date": "2018-12-20T10:56:22"
}

GEThttps://api.zenoti.com/v1/guests/{guest_id}/notes?view_private={view_private}&view_only_profile_alerts={view_only_profile_alerts}
Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57/notes?view_private=view_private&view_only_profile_alerts=view_only_profile_alerts&noteType=-1&page=1&size=10', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response:
{
  "notes": [
    {
      "id": "da60c80d-75ad-4ea3-9046-81cec2e54587",
      "is_private": true,
      "alert": false,
      "note_type": 2,
      "notes": "sample string 4",
      "center": {
        "id": "c56f4e05-62b5-4033-b42e-b72db37722df",
        "name": "London"
      },
      "added_by": {
        "id": "",
        "name": " "
      },
      "created_date": "2018-12-20T13:23:29"
    },
    {
      "id": "76d85b17-4a5d-4726-a8ef-a29de4c57e8d",
      "is_private": false,
      "alert": true,
      "note_type": 10,
      "notes": "sample string 4",
      "center": {
        "id": "c56f4e05-62b5-4033-b42e-b72db37722df",
        "name": "London"
      },
      "added_by": {
        "id": "",
        "name": " "
      },
      "created_date": "2018-12-20T13:23:32"
    }
  ]
}


PUT https://api.zenoti.com/v1/guests/{guest_id}/notes/{note_id}

Request
const options = {
  method: 'PUT',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57/notes/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "id": "9805fb48-4c52-44fc-90da-66b1d063e8bb",
  "is_private": false,
  "alert": true,
  "note_type": 8,
  "notes": "sample string 4",
  "center": {
    "id": "c56f4e05-62b5-4033-b42e-b72db37722df",
    "name": "London"
  },
  "added_by": {
    "id": "",
    "name": ""
  },
  "created_date": "2018-12-20T11:06:57"
}

DELETE https://api.zenoti.com/v1/guests/{guest_id}/notes/{note_id}
Request
const options = {
  method: 'DELETE',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/guests/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57/notes/d6cfc4ed-f7b6-454a-a8cd-36a67a324e57', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
"note deleted sucessfully”


POST https://api.zenoti.com/v1/bookings?is_double_booking_enabled={is_double_booking_enabled} 
Requests 
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  },
  body: JSON.stringify({is_only_catalog_employees: true})
};

fetch('https://api.zenoti.com/v1/bookings?is_double_booking_enabled=true (COPY)', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "id": "15b0cc65-1e47-440d-8208-966959e8c93e",
  "error": null
}


GET  https://api.zenoti.com/v1/appointments
Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/appointments', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
[
  {
    "appointment_id": "bcffd302-976b-4c88-878b-835a40093541",
    "appointment_segment_id": null,
    "appointment_group_id": "f42b502a-2b87-4ea3-863a-99fa2c790651",
    "invoice_id": "e338dd15-ba6e-4dac-a32d-55f8975636cd",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-15T05:00:00",
    "start_time_utc": "2019-09-15T09:00:00",
    "end_time": "2019-09-15T05:15:00",
    "end_time_utc": "2019-09-15T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "875b35fd-065f-4b63-b18b-69904bc123d6",
    "appointment_segment_id": null,
    "appointment_group_id": "688985ef-af8c-4f2b-a016-df2f07747c6c",
    "invoice_id": "f8c6d7d6-8dc5-435f-b361-e7f80d500d92",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-16T05:00:00",
    "start_time_utc": "2019-09-16T09:00:00",
    "end_time": "2019-09-16T05:15:00",
    "end_time_utc": "2019-09-16T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "b158e7ec-401c-453d-a805-eb274acd6745",
    "appointment_segment_id": null,
    "appointment_group_id": "5edfccd6-17a7-4d31-a4a8-939c73fc1423",
    "invoice_id": "1d39683f-7838-47d4-b5a2-2591a11d0f7d",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-17T05:00:00",
    "start_time_utc": "2019-09-17T09:00:00",
    "end_time": "2019-09-17T05:15:00",
    "end_time_utc": "2019-09-17T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "cd8d60d4-d98c-4f52-abcd-12b658f87bba",
    "appointment_segment_id": null,
    "appointment_group_id": "5b10dadd-c6b8-479b-840e-23e458560108",
    "invoice_id": "bff7a115-6fb2-461b-898c-2684c1aa669c",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-17T13:15:00",
    "start_time_utc": "2019-09-17T17:15:00",
    "end_time": "2019-09-17T13:30:00",
    "end_time_utc": "2019-09-17T17:30:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": true,
    "guest": {
      "id": "9db6b0db-f93b-43ba-8dd4-cb317ac95e31",
      "first_name": "simon",
      "last_name": "simon",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 7777777777"
      },
      "email": "simon@simon.com",
      "indicator": "1@1@0@0@0@1@0@0@0@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-09-17T03:05:00",
    "creation_date_utc": "2019-09-17T07:05:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "4dc67d5b-9be3-4e04-89fe-437034dee400",
    "appointment_segment_id": null,
    "appointment_group_id": "5b10dadd-c6b8-479b-840e-23e458560108",
    "invoice_id": "bff7a115-6fb2-461b-898c-2684c1aa669c",
    "service": {
      "id": "3185f93e-9ca5-4b50-afb5-f013d3f2ff9b",
      "name": "30 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": false,
      "override_default_product_consumption": false
    },
    "start_time": "2019-09-17T13:30:00",
    "start_time_utc": "2019-09-17T17:30:00",
    "end_time": "2019-09-17T14:00:00",
    "end_time_utc": "2019-09-17T18:00:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": true,
    "guest": {
      "id": "9db6b0db-f93b-43ba-8dd4-cb317ac95e31",
      "first_name": "simon",
      "last_name": "simon",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 7777777777"
      },
      "email": "simon@simon.com",
      "indicator": "1@1@0@0@0@1@0@0@0@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "#0#0",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": null,
    "blockout": null,
    "creation_date": "2019-09-17T03:05:00",
    "creation_date_utc": "2019-09-17T07:05:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "ffcf36bc-b739-4f37-8869-a708d3b99919",
    "appointment_segment_id": null,
    "appointment_group_id": "05c1c326-eed7-45f2-ae8c-84e7e3f3b977",
    "invoice_id": "add6f53d-510b-4500-9586-9b115bbfb0da",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-18T05:00:00",
    "start_time_utc": "2019-09-18T09:00:00",
    "end_time": "2019-09-18T05:15:00",
    "end_time_utc": "2019-09-18T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "c492a07d-e643-4acc-b61f-90b7006fed7c",
    "appointment_segment_id": null,
    "appointment_group_id": "97d29259-23ea-416c-9270-7d99f755212b",
    "invoice_id": "79184a9b-4090-4c31-a659-c4c3531c4c85",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-19T05:00:00",
    "start_time_utc": "2019-09-19T09:00:00",
    "end_time": "2019-09-19T05:15:00",
    "end_time_utc": "2019-09-19T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "3ca2fd62-7930-4961-84ce-24e0464c46cf",
    "appointment_segment_id": null,
    "appointment_group_id": "8a859d9e-e44b-43c4-8494-d2609d2a680f",
    "invoice_id": "141c21d9-32b4-4114-9442-e0417bc327ab",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-20T05:00:00",
    "start_time_utc": "2019-09-20T09:00:00",
    "end_time": "2019-09-20T05:15:00",
    "end_time_utc": "2019-09-20T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "error": null
  },
  {
    "appointment_id": "8458a39f-5864-489c-bc33-aea711d582f7",
    "appointment_segment_id": null,
    "appointment_group_id": "6130114a-4971-4b43-8945-8a09702da78f",
    "invoice_id": "e32fa8dd-2023-4fa7-b514-63a9e2849106",
    "service": {
      "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
      "name": "15 minutes",
      "is_addon": false,
      "has_addons": true,
      "parent_appointment_id": null,
      "business_unit": {
        "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
        "name": "Default",
        "id": 237
      },
      "category": {
        "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
        "name": "Massages"
      },
      "sub_category": {
        "id": "21077983-1e94-4f46-9a08-c7676819c65b",
        "name": "Feet Massage"
      },
      "override_product_consumption": true,
      "override_default_product_consumption": true
    },
    "start_time": "2019-09-21T05:00:00",
    "start_time_utc": "2019-09-21T09:00:00",
    "end_time": "2019-09-21T05:15:00",
    "end_time_utc": "2019-09-21T09:15:00",
    "status": 0,
    "source": 0,
    "progress": 0,
    "locked": false,
    "invoice_locked": false,
    "has_active_membership_for_auto_pay": false,
    "guest": {
      "id": "201416e7-add8-4093-968b-a4d878a6842f",
      "first_name": "Kirity",
      "last_name": "Chennai1",
      "gender": 0,
      "mobile": {
        "country_id": 0,
        "number": null,
        "display_number": "+91 9885517727"
      },
      "email": "kirityg@zenoti.com",
      "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
      "lp_tier_info": "0@x",
      "GuestIndicatorValue": null
    },
    "therapist": {
      "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
      "first_name": "Biometric1",
      "last_name": "emp1",
      "nick_name": null,
      "display_name": null,
      "email": "be1@em.com",
      "gender": 1,
      "vanity_image_url": ""
    },
    "room": null,
    "equipment": null,
    "service_custom_data_indicator": "1#1#0#0#0#1#1",
    "notes": null,
    "price": null,
    "actual_start_time": null,
    "actual_completed_time": null,
    "checkin_time": null,
    "therapist_preference_type": 0,
    "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
    "blockout": null,
    "creation_date": "2019-03-12T03:30:00",
    "creation_date_utc": "2019-03-12T07:30:00",
    "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
    "closed_by_id": null,
    "show_in_calender": 1,
    "available_therapists": null,
    "available_rooms": null,
    "available_times": null,
    "selected_therapist_id": null,
    "selected_room_id": null,
    "selected_time": "0001-01-01T00:00:00",
    "requested_alternative": 0,
    "group_invoice_id": null,
    "Error": null
  }
]

GET https://api.zenoti.com/v1/appointments/{appointment_id}/forms_data?tag_Id={tag_id}&view_context={view_context}&version_no={version_no}

Request 
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/appointments/appointment_id/forms_data?tag_Id=tag_id&view_context=view_context&version_no=version_no', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "data": null,
  "guest_data": null,
  "is_form_submitted": false,
  "error": null
}


GET https://api.zenoti.com/v1/appointments/{appointment_id}

Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/appointments/appointment_id', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "appointment_id": "bcffd302-976b-4c88-878b-835a40093541",
  "appointment_segment_id": null,
  "appointment_group_id": "f42b502a-2b87-4ea3-863a-99fa2c790651",
  "invoice_id": "e338dd15-ba6e-4dac-a32d-55f8975636cd",
  "service": {
    "id": "151579b2-70f6-42ad-9b83-a2d735fcf645",
    "name": "15 minutes",
    "is_addon": false,
    "has_addons": true,
    "parent_appointment_id": null,
    "business_unit": {
      "guid": "9af1b5a3-d907-4f4a-b410-5e1316f3d5c4",
      "name": "Default",
      "id": 237
    },
    "category": {
      "id": "517ff077-1210-4f17-ad9a-c386e2c701aa",
      "name": "Massages"
    },
    "sub_category": {
      "id": "21077983-1e94-4f46-9a08-c7676819c65b",
      "name": "Feet Massage"
    },
    "override_product_consumption": true,
    "override_default_product_consumption": true
  },
  "start_time": "2019-09-15T05:00:00",
  "start_time_utc": "2019-09-15T09:00:00",
  "end_time": "2019-09-15T05:15:00",
  "end_time_utc": "2019-09-15T09:15:00",
  "status": 0,
  "source": 0,
  "progress": 0,
  "locked": false,
  "invoice_locked": false,
  "has_active_membership_for_auto_pay": false,
  "guest": {
    "id": "201416e7-add8-4093-968b-a4d878a6842f",
    "first_name": "Kirity",
    "last_name": "Chennai1",
    "gender": 0,
    "mobile": {
      "country_id": 0,
      "number": null,
      "display_number": "+91 9885517727"
    },
    "email": "kirityg@zenoti.com",
    "indicator": "1@2@0@1@0@0@0@1@1@0@0@0@2@0",
    "lp_tier_info": "0@x",
    "GuestIndicatorValue": null
  },
  "therapist": {
    "id": "0c82f23e-9953-47bb-a587-aa3251c1c8c7",
    "first_name": "Biometric1",
    "last_name": "emp1",
    "nick_name": null,
    "display_name": null,
    "email": "be1@em.com",
    "gender": 1,
    "vanity_image_url": ""
  },
  "room": null,
  "equipment": null,
  "service_custom_data_indicator": "1#1#0#0#0#1#1",
  "notes": null,
  "price": null,
  "actual_start_time": null,
  "actual_completed_time": null,
  "checkin_time": null,
  "therapist_preference_type": 0,
  "form_id": "24c77db7-aadf-4cd3-9c1a-b74179a009bb",
  "blockout": null,
  "creation_date": "2019-03-12T03:30:00",
  "creation_date_utc": "2019-03-12T07:30:00",
  "created_by_id": "5b2a4f2a-489b-45bf-9fc7-b2d413c2870b",
  "closed_by_id": null,
  "show_in_calender": 1,
  "available_therapists": null,
  "available_rooms": null,
  "available_times": null,
  "selected_therapist_id": null,
  "selected_room_id": null,
  "selected_time": "0001-01-01T00:00:00",
  "requested_alternative": 0,
  "group_invoice_id": null,
  "error": null
}




Reports:
GET https://api.zenoti.com/v1/Centers/{center_id}/collections_report?start_date={start_date}&end_date={end_date}
Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/Centers/center_id/collections_report?include_transactions=false&include_employee_tips=false&start_date=start_date&end_date=end_date', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
    "collections_report": [
        {
            "invoice_id": "8f14ea37-dce8-4bc2-913a-aa0f36889f8a",
            "invoice_no": "2777",
            "reciept_no": "R201907241",
            "created_date": "2019-07-24T00:00:00",
            "status": 4,
            "total_collection": 1131.35,
            "gross_amount": 1131.35,
            "net_amount": 1131.35,
            "discount": 0.0,
            "rounding_adjustment": 0.0,
            "cashback": 0.0,
            "guest_id": "abeaa6d9-9d8b-4552-9b75-ea8d166a2a81",
            "items": [
                {
                    "id": "69fab682-1c16-43ba-8f13-ef12b998bc31",
                    "name": "60 Min Hot Stone Custom Massage Session",
                    "code": "60HSCMS",
                    "type": "Service",
                    "quantity": 1,
                    "final_sale_price": 1076.35,
                    "discount": 0.0,
                    "cashback_redemption": 0.0,
                    "therapist_id": "d833bde1-ace2-45fd-923c-85c873ce7600",
                    "taxes": [
                        {
                            "type": "Sales Tax",
                            "amount": 48.925,
                            "tax_percentage": 5.0,
                            "item_percentage": 100.0
                        },
                        {
                            "type": "Luxury Tax",
                            "amount": 48.925,
                            "tax_percentage": 5.0,
                            "item_percentage": 100.0
                        }
                    ],
                    "payments": [
                        {
                            "type": "CC",
                            "detail_type": "Amex",
                            "amount": 95.1385,
                            "tax": 8.649,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "CC",
                            "detail_type": "Visa",
                            "amount": 95.1385,
                            "tax": 8.649,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "LP",
                            "detail_type": null,
                            "amount": 95.1385,
                            "tax": 8.649,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "CC",
                            "detail_type": "Mastercard",
                            "amount": 95.1386,
                            "tax": 8.649,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "custom",
                            "detail_type": null,
                            "amount": 95.1386,
                            "tax": 8.649,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "CASH",
                            "detail_type": null,
                            "amount": 600.6573,
                            "tax": 54.6052,
                            "tip": 220.0,
                            "ssg": 0.0
                        }
                    ]
                },
                {
                    "id": "60f9d3fe-8b8f-4341-a730-22ee5445b782",
                    "name": "MOROCCANOIL Soften & Shine Set",
                    "code": "400200001",
                    "type": "Product",
                    "quantity": 1,
                    "final_sale_price": 55.0,
                    "discount": 0.0,
                    "cashback_redemption": 0.0,
                    "therapist_id": "46cd4a55-4ded-4c42-bccb-421755a84845",
                    "taxes": [
                        {
                            "type": "Sales Tax",
                            "amount": 2.5,
                            "tax_percentage": 5.0,
                            "item_percentage": 100.0
                        },
                        {
                            "type": "Luxury Tax",
                            "amount": 2.5,
                            "tax_percentage": 5.0,
                            "item_percentage": 100.0
                        }
                    ],
                    "payments": [
                        {
                            "type": "CC",
                            "detail_type": "Mastercard",
                            "amount": 4.8614,
                            "tax": 0.4419,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "custom",
                            "detail_type": null,
                            "amount": 4.8614,
                            "tax": 0.4419,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "CC",
                            "detail_type": "Amex",
                            "amount": 4.8615,
                            "tax": 0.442,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "CC",
                            "detail_type": "Visa",
                            "amount": 4.8615,
                            "tax": 0.442,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "LP",
                            "detail_type": null,
                            "amount": 4.8615,
                            "tax": 0.442,
                            "tip": 0.0,
                            "ssg": 0.0
                        },
                        {
                            "type": "CASH",
                            "detail_type": null,
                            "amount": 30.6927,
                            "tax": 2.7902,
                            "tip": 0.0,
                            "ssg": 0.0
                        }
                    ]
                }
            ]
        },
        {
            "invoice_id": "692f33f3-f3cb-4204-a799-d6797a9d5194",
            "invoice_no": "2778",
            "reciept_no": "",
            "created_date": "2019-07-24T00:00:00",
            "status": 0,
            "total_collection": 55.0,
            "gross_amount": 55.0,
            "net_amount": 55.0,
            "discount": 0.0,
            "rounding_adjustment": 0.0,
            "cashback": 0.0,
            "guest_id": "abeaa6d9-9d8b-4552-9b75-ea8d166a2a81",
            "items": [
                {
                    "id": "60f9d3fe-8b8f-4341-a730-22ee5445b782",
                    "name": "MOROCCANOIL Soften & Shine Set",
                    "code": "400200001",
                    "type": "Product",
                    "quantity": 1,
                    "final_sale_price": 55.0,
                    "discount": 0.0,
                    "cashback_redemption": 0.0,
                    "therapist_id": "46cd4a55-4ded-4c42-bccb-421755a84845",
                    "taxes": [
                        {
                            "type": "Sales Tax",
                            "amount": 2.5,
                            "tax_percentage": 5.0,
                            "item_percentage": 100.0
                        },
                        {
                            "type": "Luxury Tax",
                            "amount": 2.5,
                            "tax_percentage": 5.0,
                            "item_percentage": 100.0
                        }
                    ],
                    "payments": [
                        {
                            "type": "CASH",
                            "detail_type": null,
                            "amount": 55.0,
                            "tax": 5.0,
                            "tip": 0.0,
                            "ssg": 0.0
                        }
                    ]
                }
            ]
        }
    ]
    "Error": null
}

GET  https://api.zenoti.com/v1/sales/salesreport?center_id={center_id}&start_date={start_date}&end_date={end_date}&item_type={item_type}&status={status}

Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/v1/sales/salesreport?center_id=center_id&start_date=start_date&end_date=end_date&item_type=item_type&status=status', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
    "center_sales_report": [
        {
            "invoice_no": "2559",
            "receipt_no": "",
            "guest": {
                "guest_id": "91eb92a1-0979-40fc-8472-a63ba0a0734f",
                "guest_name": "ADD AAA",
                "guest_code": ""
            },
            "sold_on": "2019-04-29T12:33:03",
            "serviced_on": "2019-07-24T12:15:00",
            "center": {
                "center_name": "Plutus IN",
                "center_code": "PLIN"
            },
            "item": {
                "type": 0,
                "name": "Hair cut",
                "code": "1"
            },
            "gift_card_code": null,
            "quantity": 1,
            "unit_price": 10.0,
            "sale_price": 10.0,
            "discount": 0.0,
            "final_sale_price": 10.0000,
            "total_tax": 0.0,
            "tax_break_up": {},
            "tax_code": "",
            "loyalty_point_redemption": 0.0000,
            "membership_redmption": 0.0000,
            "prepaid_card_redemption": 0.0000,
            "cashback_redemption": 0.0000,
            "package_redemption": 0.0000,
            "cash": 0.0000,
            "card": 0.0000,
            "check": 0.0000,
            "custom": 0.0000,
            "points": 0.0000,
            "membership_paid": 0.0000,
            "prepaid_card": 0.0000,
            "last_payment_date": "0001-01-01T00:00:00",
            "invoice_item_id": "7818c51a-9805-48c6-8ee0-e8069e2d6a35",
            "rounding_adjustment": 0.0000,
            "tips": 0.0000,
            "employee": {
                "name": "2 centers emp",
                "code": "2 centers emp",
                "job_code": ""
            },
            "tags": "t9",
            "promotion": "",
            "coupon_printed": "",
            "first_visit": "No",
            "package": "",
            "package_invoice": "",
            "due": 10.0,
            "payment_type": "",
            "business_unit_name": "Default",
            "state_code": "37",
            "SAC": "dafss",
            "created_date_in_center": "2019-04-29T12:33:03.857",
            "item_row_num": 1,
            "row_num": 1,
            "HSN": ""
        },
        {
            "invoice_no": "2775",
            "receipt_no": "",
            "guest": {
                "guest_id": "9e668842-f8f2-4e0d-8ebc-a57bd39683b0",
                "guest_name": "New Owner",
                "guest_code": ""
            },
            "sold_on": "2019-07-24T08:57:26",
            "serviced_on": "2019-07-24T09:00:00",
            "center": {
                "center_name": "Plutus IN",
                "center_code": "PLIN"
            },
            "item": {
                "type": 0,
                "name": "60 Min Thai Session",
                "code": "TS60"
            },
            "gift_card_code": null,
            "quantity": 1,
            "unit_price": 20.0,
            "sale_price": 20.0,
            "discount": 0.0,
            "final_sale_price": 20.0000,
            "total_tax": 0.0,
            "tax_break_up": {},
            "tax_code": "",
            "loyalty_point_redemption": 0.0000,
            "membership_redmption": 0.0000,
            "prepaid_card_redemption": 0.0000,
            "cashback_redemption": 0.0000,
            "package_redemption": 0.0000,
            "cash": 0.0000,
            "card": 0.0000,
            "check": 0.0000,
            "custom": 0.0000,
            "points": 0.0000,
            "membership_paid": 0.0000,
            "prepaid_card": 0.0000,
            "last_payment_date": "0001-01-01T00:00:00",
            "invoice_item_id": "fc2c4e44-d5f7-44d1-8c60-1873ddd9bb51",
            "rounding_adjustment": 0.0000,
            "tips": 0.0000,
            "employee": {
                "name": "2 centers emp",
                "code": "2 centers emp",
                "job_code": ""
            },
            "tags": "",
            "promotion": "",
            "coupon_printed": "",
            "first_visit": "Yes",
            "package": "",
            "package_invoice": "",
            "due": 20.0,
            "payment_type": "",
            "business_unit_name": "Default",
            "state_code": "37",
            "SAC": "xgv",
            "created_date_in_center": "2019-07-24T08:57:26.343",
            "item_row_num": 1,
            "row_num": 2,
            "HSN": ""
        },
        {
            "invoice_no": "2776",
            "receipt_no": "",
            "guest": {
                "guest_id": "92757fd8-bec3-4dae-b5cd-893548e0a6a3",
                "guest_name": "Nnnn Nnn",
                "guest_code": ""
            },
            "sold_on": "2019-07-24T08:57:51",
            "serviced_on": "2019-07-24T09:00:00",
            "center": {
                "center_name": "Plutus IN",
                "center_code": "PLIN"
            },
            "item": {
                "type": 0,
                "name": "60 Min Thai Session",
                "code": "TS60"
            },
            "gift_card_code": null,
            "quantity": 1,
            "unit_price": 20.0,
            "sale_price": 20.0,
            "discount": 0.0,
            "final_sale_price": 20.0000,
            "total_tax": 0.0,
            "tax_break_up": {},
            "tax_code": "",
            "loyalty_point_redemption": 0.0000,
            "membership_redmption": 0.0000,
            "prepaid_card_redemption": 0.0000,
            "cashback_redemption": 0.0000,
            "package_redemption": 0.0000,
            "cash": 0.0000,
            "card": 0.0000,
            "check": 0.0000,
            "custom": 0.0000,
            "points": 0.0000,
            "membership_paid": 0.0000,
            "prepaid_card": 0.0000,
            "last_payment_date": "0001-01-01T00:00:00",
            "invoice_item_id": "a2d7e8ab-f770-4e9b-a7a2-e19e57780729",
            "rounding_adjustment": 0.0000,
            "tips": 0.0000,
            "employee": {
                "name": "hell no",
                "code": "e90",
                "job_code": "Ins01"
            },
            "tags": "",
            "promotion": "",
            "coupon_printed": "",
            "first_visit": "Yes",
            "package": "",
            "package_invoice": "",
            "due": 20.0,
            "payment_type": "",
            "business_unit_name": "Default",
            "state_code": "37",
            "SAC": "xgv",
            "created_date_in_center": "2019-07-24T08:57:51.53",
            "item_row_num": 1,
            "row_num": 3,
            "HSN": ""
        },
        {
            "invoice_no": "2777",
            "receipt_no": "R201907241",
            "guest": {
                "guest_id": "abeaa6d9-9d8b-4552-9b75-ea8d166a2a81",
                "guest_name": "simon babu",
                "guest_code": ""
            },
            "sold_on": "2019-07-24T14:59:59",
            "serviced_on": "2019-07-24T08:00:00",
            "center": {
                "center_name": "Plutus IN",
                "center_code": "PLIN"
            },
            "item": {
                "type": 0,
                "name": "60 Min Hot Stone Custom Massage Session",
                "code": "60HSCMS"
            },
            "gift_card_code": null,
            "quantity": 1,
            "unit_price": 978.5,
            "sale_price": 978.5,
            "discount": 0.0,
            "final_sale_price": 1076.3500,
            "total_tax": 97.85,
            "tax_break_up": {},
            "tax_code": "GST",
            "loyalty_point_redemption": 0.0000,
            "membership_redmption": 0.0000,
            "prepaid_card_redemption": 0.0000,
            "cashback_redemption": 0.0000,
            "package_redemption": 0.0000,
            "cash": 600.6570,
            "card": 285.4160,
            "check": 0.0000,
            "custom": 95.1390,
            "points": 95.1380,
            "membership_paid": 0.0000,
            "prepaid_card": 0.0000,
            "last_payment_date": "2019-07-24T15:04:02",
            "invoice_item_id": "ef2257bf-3dbf-4842-a2df-52df833e287b",
            "rounding_adjustment": 0.0000,
            "tips": 220.0000,
            "employee": {
                "name": "2 centers emp",
                "code": "2 centers emp",
                "job_code": ""
            },
            "tags": "",
            "promotion": "",
            "coupon_printed": "",
            "first_visit": "No",
            "package": "",
            "package_invoice": "",
            "due": 0.0,
            "payment_type": "Cash, CC Online(Amex), CC Online(Mastercard), CC Online(Visa), Custom-Newton(Newton), LoyaltyPoints",
            "business_unit_name": "Default",
            "state_code": "37",
            "SAC": "sdsdsdsds",
            "created_date_in_center": "2019-07-24T14:59:59.787",
            "item_row_num": 1,
            "row_num": 4,
            "HSN": ""
        },
        {
            "invoice_no": "2777",
            "receipt_no": "R201907241",
            "guest": {
                "guest_id": "abeaa6d9-9d8b-4552-9b75-ea8d166a2a81",
                "guest_name": "simon babu",
                "guest_code": ""
            },
            "sold_on": "2019-07-24T14:59:34",
            "serviced_on": "0001-01-01T00:00:00",
            "center": {
                "center_name": "Plutus IN",
                "center_code": "PLIN"
            },
            "item": {
                "type": 2,
                "name": "MOROCCANOIL Soften & Shine Set",
                "code": "400200001"
            },
            "gift_card_code": null,
            "quantity": 1,
            "unit_price": 50.0,
            "sale_price": 50.0,
            "discount": 0.0,
            "final_sale_price": 55.0000,
            "total_tax": 5.0,
            "tax_break_up": {},
            "tax_code": "GST",
            "loyalty_point_redemption": 0.0000,
            "membership_redmption": 0.0,
            "prepaid_card_redemption": 0.0000,
            "cashback_redemption": 0.0,
            "package_redemption": 0.0,
            "cash": 30.6930,
            "card": 14.5840,
            "check": 0.0000,
            "custom": 4.8610,
            "points": 4.8620,
            "membership_paid": 0.0000,
            "prepaid_card": 0.0000,
            "last_payment_date": "2019-07-24T15:04:02",
            "invoice_item_id": "26d7330a-15c2-4683-ad84-e7a719055f5a",
            "rounding_adjustment": 0.0000,
            "tips": 10.6952,
            "employee": {
                "name": "pattabhiorg owner",
                "code": "10",
                "job_code": "hpc01"
            },
            "tags": "",
            "promotion": "",
            "coupon_printed": "",
            "first_visit": "No",
            "package": "",
            "package_invoice": "",
            "due": 0.0,
            "payment_type": "Cash, CC Online(Amex), CC Online(Mastercard), CC Online(Visa), Custom-Newton(Newton), LoyaltyPoints",
            "business_unit_name": "Default",
            "state_code": "37",
            "SAC": "",
            "created_date_in_center": "2019-07-24T14:59:34.647",
            "item_row_num": 2,
            "row_num": 4,
            "HSN": "TestGSTProduct"
        },
        {
            "invoice_no": "2778",
            "receipt_no": "0",
            "guest": {
                "guest_id": "abeaa6d9-9d8b-4552-9b75-ea8d166a2a81",
                "guest_name": "simon babu",
                "guest_code": ""
            },
            "sold_on": "2019-07-24T15:55:40",
            "serviced_on": "0001-01-01T00:00:00",
            "center": {
                "center_name": "Plutus IN",
                "center_code": "PLIN"
            },
            "item": {
                "type": 2,
                "name": "MOROCCANOIL Soften & Shine Set",
                "code": "400200001"
            },
            "gift_card_code": null,
            "quantity": 1,
            "unit_price": 50.0,
            "sale_price": 50.0,
            "discount": 0.0,
            "final_sale_price": 55.0000,
            "total_tax": 5.0,
            "tax_break_up": {},
            "tax_code": "GST",
            "loyalty_point_redemption": 0.0000,
            "membership_redmption": 0.0,
            "prepaid_card_redemption": 0.0000,
            "cashback_redemption": 0.0,
            "package_redemption": 0.0,
            "cash": 55.0000,
            "card": 0.0000,
            "check": 0.0000,
            "custom": 0.0000,
            "points": 0.0000,
            "membership_paid": 0.0000,
            "prepaid_card": 0.0000,
            "last_payment_date": "2019-07-24T15:55:57",
            "invoice_item_id": "1c13b3e0-9d42-4707-bbdf-89d745a59fc4",
            "rounding_adjustment": 0.0000,
            "tips": 0.0000,
            "employee": {
                "name": "pattabhiorg owner",
                "code": "10",
                "job_code": "hpc01"
            },
            "tags": "",
            "promotion": "",
            "coupon_printed": "",
            "first_visit": "No",
            "package": "",
            "package_invoice": "",
            "due": 0.0,
            "payment_type": "Cash",
            "business_unit_name": "Default",
            "state_code": "37",
            "SAC": "",
            "created_date_in_center": "2019-07-24T15:55:40.517",
            "item_row_num": 1,
            "row_num": 5,
            "HSN": "TestGSTProduct"
        }
    ]
    "Error": null
}


POST https://api.zenoti.com/{api_url} /v1/reports/collections/flat_file
Request 
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/api_url%20/v1/reports/collections/flat_file', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response
{
  "collections": [
    {
      "payment_date": "2021-12-22T00:00:00",
      "invoice_no": "RR10961",
      "guest_name": "Tarc Lopez",
      "center_name": "Khammam",
      "center_code": "KMM",
      "tax_collected": 0,
      "payment_type": "Cash",
      "amount_paid": 0,
      "amount_paid_exc_tax": 0,
      "total_paid": 4770,
      "amount_paid_inc_tax_tip_ssg": 1350,
      "due": 0,
      "tip": 0,
      "ssg": 1350,
      "esf": 0,
      "cash_back": 0,
      "card_type": "Visa",
      "card_number": "",
      "card_invoice_no": "",
      "card_bank_name": "",
      "card_expiry": "",
      "check_number": "",
      "check_bank_name": "",
      "check_date": "",
      "additional_data": "",
      "collected_by": "Tangerinespa_Own Owner",
      "collected_by_code": "IvyOwner",
      "invoice_status": "Open",
      "invoice_id": "a613ce4c-4e90-4600-be9e-9ee7479b0955",
      "guest_id": "e3259138-76e1-4451-be34-53482cd42a90",
      "center_id": "a11f578a-1b81-4de0-8834-915f79e5362b",
      "invoice_center": "Khammam"
    },
    {
      "payment_date": "2021-12-22T00:00:00",
      "invoice_no": "RR10961",
      "guest_name": "Tarc Lopez",
      "center_name": "Khammam",
      "center_code": "KMM",
      "tax_collected": 270,
      "payment_type": "Cash",
      "amount_paid": 4770,
      "amount_paid_exc_tax": 4500,
      "total_paid": 4770,
      "amount_paid_inc_tax_tip_ssg": 4770,
      "due": 0,
      "tip": 0,
      "ssg": 0,
      "esf": 0,
      "cash_back": 0,
      "card_type": "Visa",
      "card_number": "",
      "card_invoice_no": "",
      "card_bank_name": "",
      "card_expiry": "",
      "check_number": "",
      "check_bank_name": "",
      "check_date": "",
      "collected_by": "Tangerinespa_Own Owner",
      "collected_by_code": "IvyOwner",
      "invoice_status": "Open",
      "invoice_id": "a613ce4c-4e90-4600-be9e-9ee7479b0955",
      "guest_id": "e3259138-76e1-4451-be34-53482cd42a90",
      "center_id": "a11f578a-1b81-4de0-8834-915f79e5362b",
      "invoice_center": "Khammam"
    },
    {
      "payment_date": "2021-12-20T00:00:00",
      "invoice_no": "RR10960",
      "guest_name": "Sellss Service",
      "center_name": "Khammam",
      "center_code": "KMM",
      "tax_collected": 300,
      "payment_type": "Cash",
      "amount_paid": 5300,
      "amount_paid_exc_tax": 5000,
      "total_paid": 5300,
      "amount_paid_inc_tax_tip_ssg": 5300,
      "due": 0,
      "tip": 0,
      "ssg": 0,
      "esf": 0,
      "cash_back": 0,
      "card_type": "Visa",
      "card_number": "",
      "card_invoice_no": "",
      "card_bank_name": "",
      "card_expiry": "",
      "check_number": "",
      "check_bank_name": "",
      "check_date": "",
      "collected_by": "Tangerinespa_Own Owner",
      "collected_by_code": "IvyOwner",
      "invoice_status": "Open",
      "invoice_id": "2bdfc272-734e-47a1-86db-d9873d92dd0e",
      "guest_id": "7a99606c-225e-4680-a618-6aa456dc8cc8",
      "center_id": "a11f578a-1b81-4de0-8834-915f79e5362b",
      "invoice_center": "Khammam"
    },
    {
      "payment_date": "2021-12-14T00:00:00",
      "invoice_no": "RR10958",
      "guest_name": "Customm Payment",
      "center_name": "Khammam",
      "center_code": "KMM",
      "tax_collected": 339.62,
      "payment_type": "Custom - ÀÂÄÆÇÈÉÊËÎÏÔŒÙÛÜàâäæçèéêë รูมเมอร์",
      "amount_paid": 6000,
      "amount_paid_exc_tax": 5660.38,
      "total_paid": 6000,
      "amount_paid_inc_tax_tip_ssg": 7698.11,
      "due": 0,
      "tip": 0,
      "ssg": 1698.11,
      "esf": 0,
      "cash_back": 0,
      "card_type": "Visa",
      "card_number": "",
      "card_invoice_no": "",
      "card_bank_name": "",
      "card_expiry": "",
      "check_number": "",
      "check_bank_name": "",
      "check_date": "",
      "custom_name": "ÀÂÄÆÇÈÉÊËÎÏÔŒÙÛÜàâäæçèéêë รูมเมอร์",
      "additional_data": "ÀÂÄÆÇÈÉÊËÎÏÔŒÙÛÜàâäæçèéêë รูมเมอร์",
      "collected_by": "Tangerinespa_Own Owner",
      "collected_by_code": "IvyOwner",
      "invoice_status": "Closed",
      "invoice_id": "5c04277b-7ac9-4951-ab7a-8863bd512967",
      "guest_id": "451b2fa4-df99-4da2-8ab9-aa0c706c2d72",
      "center_id": "a11f578a-1b81-4de0-8834-915f79e5362b",
      "invoice_center": "Khammam",
      "invoice_closed_date": "2021-12-14T00:00:00"
    }
  ],
  "total": {
    "amount_paid": 16070,
    "amount_paid_exc_tax": 15160.38,
    "amount_paid_inc_tax_tip_ssg": 19118.11,
    "tip": 0,
    "ssg": 3048.11,
    "tax_collected": 909.62
  },
  "page_info": {
    "total": 4,
    "page": 1,
    "size": 10
  },
  "error": null
}


GET https://api.zenoti.com/{api_url} /v1/invoices/{invoice_id}
Request
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: 'apikey 6c803b36ca624c51990fcce64e537399a7cd051e74c2495e898b23ccdedb8632'
  }
};

fetch('https://api.zenoti.com/api_url%20/v1/invoices/invoice_id', options)
  .then(res => res.json())
  .then(res => console.log(res))
  .catch(err => console.error(err));

Response 
{
  "invoice": {
    "group_invoice_id": null,
    "id": "34ca4f0f-c11c-434f-9a36-cba6df701397",
    "invoice_number": "117798",
    "invoice_number_prefix": "CMEMGM",
    "receipt_number": "CMEMGMR2308",
    "appointment_group_id": "28d49469-9256-4893-b5fb-2b7e269b4120",
    "lock": false,
    "is_closed": true,
    "is_refund": false,
    "invoice_date": "2025-01-21T13:00:00",
    "has_redemptions": true,
    "center_id": "7aac6915-9252-4dbf-bbff-028e41836ea8",
    "gstin": "",
    "gst_sequence": {
      "prefix": "",
      "number": ""
    },
    "invoice_dues": {
      "total": 3014.9,
      "paid": 3014.9,
      "balance": 0
    },
    "environmental_fee": {
      "total": 10,
      "paid": 10,
      "balance": 0
    },
    "total_price": {
      "currency_id": 0,
      "net_price": 3000,
      "tax": 4.9,
      "rounding_adjustment": 0,
      "sum_total": 3004.9
    },
    "guest": {
      "id": "e1d61626-629c-4531-8fb5-9b782e21214f",
      "first_name": "Vikas",
      "last_name": "Yadav",
      "gender": 1,
      "code": "",
      "mobile_phone": "+1 8754673816",
      "email": null
    },
    "invoice_items": [
      {
        "invoice_item_id": "2b31596e-19c2-4f58-8f5f-d5fc0a1e7250",
        "id": "3185f93e-9ca5-4b50-afb5-f013d3f2ff9b",
        "name": "30 minutes",
        "type": 0,
        "is_giftcard": null,
        "code": "30m",
        "price": {
          "currency_id": 148,
          "sales": 50,
          "tax": 4.9,
          "final": 54.1,
          "discount": 0
        },
        "quantity": 1,
        "sale_by_id": "4fa7827c-b941-4530-ad72-9e9cd1364861",
        "therapist_name": "Agent Support ",
        "sac": ""
      },
      {
        "invoice_item_id": "c368d2dc-82fd-4983-a9c0-e3df75c79498",
        "id": "ec049cfd-6f8e-4937-912a-f9ec93a3b48d",
        "name": "1 class pack - 5 credits",
        "type": 4,
        "is_giftcard": null,
        "code": "1cp_5credits",
        "price": {
          "currency_id": 148,
          "sales": 3000,
          "tax": 0,
          "final": 2950.8,
          "discount": 0
        },
        "quantity": 1,
        "sale_by_id": "4fa7827c-b941-4530-ad72-9e9cd1364861",
        "therapist_name": "Agent Support ",
        "sac": ""
      }
    ],
    "appointments": [
      {
        "id": "5421849a-c163-4b16-80c6-e053274700db",
        "invoice_item_id": "2b31596e-19c2-4f58-8f5f-d5fc0a1e7250",
        "service_name": "30 minutes",
        "service_id": "3185f93e-9ca5-4b50-afb5-f013d3f2ff9b",
        "start_time": "2025-01-21T07:30:00",
        "end_time": "2025-01-21T08:00:00",
        "serviceduration_in_miutes": 30,
        "has_add_ons": true,
        "is_add_on": false,
        "therapist_name": "Agent S",
        "TherapistId": "4fa7827c-b941-4530-ad72-9e9cd1364861",
        "package_id": null,
        "is_recurring": false,
        "cart_item_id": null,
        "appointment_type": 2,
        "therapist_request_type": 4,
        "room_id": null,
        "room_name": "Chennai  Room 1",
        "equipment_id": null,
        "equipment_name": ""
      }
    ],
    "transactions": [
      {
        "payment_option": {
          "id": "f5af004c-37ef-478f-868f-38d3a37aebc1",
          "payment_mode": 0,
          "payment_name": "CASH",
          "card_number": "",
          "additional_data": null
        },
        "total_amount_paid": 3024.9,
        "amount_paid": 3004.9,
        "tip_amount": 0,
        "ssg_amount": 10,
        "donation_amount": 0,
        "fee_amount": 10,
        "cash_back_amount": 0,
        "transaction_id": "7322adcd-21c9-4df7-92c6-191a7b73f70b",
        "payment_date": "2025-01-21T17:58:30",
        "cash_regester_id": null,
        "gst_sequences": []
      }
    ],
    "additional_fields": []
  },
  "error": null
}